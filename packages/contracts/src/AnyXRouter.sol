// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IUSDC} from "./interfaces/IUSDC.sol";
import {SwapExecutor} from "./SwapExecutor.sol";

/// @title AnyXRouter
/// @notice Takes any supported ERC-20, swaps it to USDC, and settles an x402
///         payment with an EIP-3009 authorization.
///
/// @dev Two invariants govern this contract, and every check exists to serve one
///      of them:
///
///      1. The recipient receives exactly what the x402 challenge asked for.
///         The AnyX fee is taken on top of that amount, never out of it.
///      2. A partial payment is impossible. If the swap yields less than the
///         payment requires, the whole transaction reverts and the payer keeps
///         their tokens.
contract AnyXRouter is SwapExecutor, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Basis-point denominator. 10_000 bps == 100%.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Hard ceiling on the spread, enforced in code rather than policy.
    /// @dev 100 bps == 1%. Even a compromised owner key cannot set a predatory
    ///      fee, which bounds the damage from an ownership compromise.
    uint256 public constant MAX_FEE_BPS = 100;

    IUSDC public immutable USDC;

    address public feeCollector;
    uint256 public feeBps;

    /// @notice The swap leg: what the payer is spending and how to sell it.
    struct SwapParams {
        IERC20 inputToken;
        uint256 inputAmount;
        /// @dev Allowlisted aggregator router.
        address router;
        /// @dev Opaque calldata from the aggregator's quote API.
        bytes swapData;
    }

    /// @notice The settlement leg: the payer's pre-signed EIP-3009 authorization.
    /// @dev Grouped into a struct because twelve flat parameters overflow the
    ///      EVM stack, and because these eight values are meaningless apart —
    ///      they are one signed object.
    struct PaymentAuthorization {
        address payTo;
        uint256 usdcRequired;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    event PaymentSettled(
        address indexed payer,
        address indexed recipient,
        address indexed inputToken,
        uint256 inputAmount,
        uint256 usdcSettled,
        uint256 feeUsdc,
        bytes32 nonce
    );
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event RouterAllowanceUpdated(address indexed router, bool allowed);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh(uint256 requested, uint256 maximum);
    error AuthorizationExpired(uint256 validBefore, uint256 nowTimestamp);
    error AuthorizationNotYetValid(uint256 validAfter, uint256 nowTimestamp);
    error NonceAlreadyUsed(bytes32 nonce);
    error AuthorizationValueMismatch(uint256 authorized, uint256 required);
    error RecipientMismatch(address authorized, address expected);

    constructor(
        address usdc,
        address initialFeeCollector,
        uint256 initialFeeBps,
        address initialOwner
    ) Ownable(initialOwner) {
        if (usdc == address(0) || initialFeeCollector == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        if (initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh(initialFeeBps, MAX_FEE_BPS);

        USDC = IUSDC(usdc);
        feeCollector = initialFeeCollector;
        feeBps = initialFeeBps;
    }

    /// @notice Swaps the payer's token to USDC and settles the x402 payment.
    ///
    /// @param swap What the payer is spending and how to sell it.
    /// @param auth The payer's pre-signed EIP-3009 authorization, which must be
    ///        for exactly `auth.usdcRequired` to exactly `auth.payTo`.
    ///
    /// @dev Ordering matters. Every cheap validation runs before any token
    ///      moves, so a payer whose authorization has already expired does not
    ///      pay for a swap that could never settle.
    function swapAndPay(SwapParams calldata swap, PaymentAuthorization calldata auth)
        external
        nonReentrant
        whenNotPaused
    {
        if (auth.payTo == address(0)) revert ZeroAddress();
        if (swap.inputAmount == 0 || auth.usdcRequired == 0) revert ZeroAmount();

        // forge-lint: disable-start(block-timestamp)
        // Validator drift of a few seconds is immaterial against a 5-minute
        // authorization window, and USDC re-checks these bounds authoritatively
        // during transferWithAuthorization. Checking here only avoids paying
        // swap costs for a payment that is already doomed.
        if (auth.validBefore <= block.timestamp) {
            revert AuthorizationExpired(auth.validBefore, block.timestamp);
        }
        if (auth.validAfter > block.timestamp) {
            revert AuthorizationNotYetValid(auth.validAfter, block.timestamp);
        }
        // forge-lint: disable-end(block-timestamp)
        if (USDC.authorizationState(msg.sender, auth.nonce)) revert NonceAlreadyUsed(auth.nonce);

        uint256 fee = (auth.usdcRequired * feeBps) / BPS_DENOMINATOR;

        // The floor is the payment plus the fee. Requiring only `usdcRequired`
        // would let a thin swap silently consume the spread.
        uint256 minUsdcOut = auth.usdcRequired + fee;

        swap.inputToken.safeTransferFrom(msg.sender, address(this), swap.inputAmount);

        uint256 usdcReceived = _executeSwap(
            swap.inputToken,
            IERC20(address(USDC)),
            swap.inputAmount,
            minUsdcOut,
            swap.router,
            swap.swapData
        );

        if (fee > 0) {
            IERC20(address(USDC)).safeTransfer(feeCollector, fee);
        }

        // The payer's own signed authorization moves USDC from the payer to the
        // recipient. This contract never holds the settlement amount, so a bug
        // here cannot redirect the payment.
        USDC.transferWithAuthorization(
            msg.sender,
            auth.payTo,
            auth.usdcRequired,
            auth.validAfter,
            auth.validBefore,
            auth.nonce,
            auth.v,
            auth.r,
            auth.s
        );

        // Everything the swap produced, less the fee, goes back to the payer.
        //
        // Note it is the *whole* remainder, not just the surplus above
        // `minUsdcOut`. The authorization above moved USDC out of the payer's
        // own balance, so the swap proceeds are what makes them whole. Refunding
        // only the surplus would strand `usdcRequired` in this contract on every
        // single payment.
        uint256 refund = usdcReceived - fee;
        if (refund > 0) {
            IERC20(address(USDC)).safeTransfer(msg.sender, refund);
        }

        emit PaymentSettled(
            msg.sender,
            auth.payTo,
            address(swap.inputToken),
            swap.inputAmount,
            auth.usdcRequired,
            fee,
            auth.nonce
        );
    }

    /// @notice Quotes the fee and required swap output for a given payment.
    /// @dev Pure read, so a client can show the payer the cost before signing.
    function quoteFee(uint256 usdcRequired)
        external
        view
        returns (uint256 fee, uint256 minUsdcOut)
    {
        fee = (usdcRequired * feeBps) / BPS_DENOMINATOR;
        minUsdcOut = usdcRequired + fee;
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function setFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) revert ZeroAddress();
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    function setRouterAllowed(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        _setRouterAllowed(router, allowed);
        emit RouterAllowanceUpdated(router, allowed);
    }

    /// @notice Halts new payments without touching funds already settled.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recovers tokens stranded by a failed swap.
    /// @dev In normal operation this contract holds no balance between
    ///      transactions, so anything here is dust or the residue of a revert.
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }
}
