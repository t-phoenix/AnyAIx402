// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ReservePool
/// @notice A USDC float on Base that fronts cross-chain and Lightning payments.
///
/// @dev CCTP takes 2-10 minutes; an x402 challenge typically expires in 300
///      seconds. Those two facts cannot be reconciled, so this pool pays
///      immediately and is replenished once the bridge clears.
///
///      Every drawdown is real money leaving before its replacement has
///      arrived, which is why the spender set is an explicit allowlist and the
///      outstanding total is capped.
contract ReservePool is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;

    /// @notice Contracts permitted to draw down the float.
    mapping(address spender => bool allowed) public authorizedSpenders;

    /// @notice USDC advanced but not yet replenished.
    uint256 public outstanding;

    /// @notice Ceiling on `outstanding`. Bounds the loss if replenishment stops.
    uint256 public maxOutstanding;

    event FloatDeposited(address indexed from, uint256 amount);
    event FloatWithdrawn(address indexed to, uint256 amount);
    event FloatDeployed(address indexed recipient, uint256 amount, uint256 outstanding);
    event FloatReplenished(uint256 amount, uint256 outstanding);
    event SpenderUpdated(address indexed spender, bool allowed);
    event MaxOutstandingUpdated(uint256 oldMax, uint256 newMax);

    error ZeroAddress();
    error ZeroAmount();
    error NotAuthorized(address caller);
    error InsufficientFloat(uint256 available, uint256 requested);
    error OutstandingLimitExceeded(uint256 wouldBe, uint256 maximum);
    error ReplenishExceedsOutstanding(uint256 amount, uint256 outstanding);

    modifier onlyAuthorized() {
        if (!authorizedSpenders[msg.sender]) revert NotAuthorized(msg.sender);
        _;
    }

    constructor(address usdc, address initialOwner, uint256 initialMaxOutstanding)
        Ownable(initialOwner)
    {
        if (usdc == address(0) || initialOwner == address(0)) revert ZeroAddress();
        USDC = IERC20(usdc);
        maxOutstanding = initialMaxOutstanding;
    }

    /// @notice Adds USDC to the float.
    function depositFloat(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit FloatDeposited(msg.sender, amount);
    }

    /// @notice Advances USDC so a payment can settle before its bridge clears.
    function frontPayment(address recipient, uint256 amount) external onlyAuthorized nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = USDC.balanceOf(address(this));
        if (available < amount) revert InsufficientFloat(available, amount);

        uint256 wouldBe = outstanding + amount;
        if (wouldBe > maxOutstanding) revert OutstandingLimitExceeded(wouldBe, maxOutstanding);

        outstanding = wouldBe;
        USDC.safeTransfer(recipient, amount);

        emit FloatDeployed(recipient, amount, outstanding);
    }

    /// @notice Returns bridged USDC to the pool and clears the debt it covers.
    function replenish(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > outstanding) revert ReplenishExceedsOutstanding(amount, outstanding);

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        outstanding -= amount;

        emit FloatReplenished(amount, outstanding);
    }

    function getAvailableFloat() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /// @notice Utilization in basis points: how much of the ceiling is in use.
    /// @dev Watch this. Sustained high utilization means the pool is about to
    ///      start refusing payments.
    function getUtilizationBps() external view returns (uint256) {
        if (maxOutstanding == 0) return 0;
        return (outstanding * 10_000) / maxOutstanding;
    }

    function setSpenderAllowed(address spender, bool allowed) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        authorizedSpenders[spender] = allowed;
        emit SpenderUpdated(spender, allowed);
    }

    function setMaxOutstanding(uint256 newMax) external onlyOwner {
        emit MaxOutstandingUpdated(maxOutstanding, newMax);
        maxOutstanding = newMax;
    }

    /// @notice Withdraws idle float.
    /// @dev Cannot touch USDC backing an outstanding advance: that money is
    ///      already owed to a recipient somewhere.
    function withdrawFloat(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = USDC.balanceOf(address(this));
        if (amount > balance) revert InsufficientFloat(balance, amount);
        USDC.safeTransfer(to, amount);
        emit FloatWithdrawn(to, amount);
    }
}
