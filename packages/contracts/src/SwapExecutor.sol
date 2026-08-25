// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SwapExecutor
/// @notice Executes an aggregator swap and measures what actually arrived.
/// @dev The security model here is deliberately narrow. We do not attempt to
///      parse or validate the aggregator's calldata — that way lies an endless
///      game of keeping up with router ABIs. Instead we measure the USDC balance
///      before and after, and require the delta to meet the floor. A malicious
///      or broken router cannot satisfy that check without actually delivering
///      the tokens.
abstract contract SwapExecutor {
    using SafeERC20 for IERC20;

    event SwapExecuted(
        address indexed inputToken, uint256 inputAmount, uint256 usdcReceived, address router
    );

    error SwapCallFailed(bytes reason);
    error InsufficientOutput(uint256 received, uint256 required);
    error RouterNotAllowed(address router);

    /// @notice Routers permitted to be called with arbitrary calldata.
    /// @dev An allowlist is essential: this contract makes a low-level call with
    ///      caller-supplied data, so an arbitrary target would let anyone make
    ///      this contract call anything.
    mapping(address router => bool allowed) public allowedRouters;

    function _setRouterAllowed(address router, bool allowed) internal {
        allowedRouters[router] = allowed;
    }

    /// @notice Swaps `inputToken` for USDC and returns the measured output.
    /// @param inputToken Token being sold. Must already be held by this contract.
    /// @param inputAmount Amount to approve to the router.
    /// @param minUsdcOut Hard floor. Set by the caller to the exact USDC the
    ///        x402 payment requires, so a shortfall reverts rather than
    ///        producing a partial payment.
    /// @param router Aggregator router. Must be allowlisted.
    /// @param swapData Opaque calldata from the aggregator's quote API.
    /// @return usdcReceived The measured balance delta, never the router's claim.
    function _executeSwap(
        IERC20 inputToken,
        IERC20 usdc,
        uint256 inputAmount,
        uint256 minUsdcOut,
        address router,
        bytes calldata swapData
    ) internal returns (uint256 usdcReceived) {
        if (!allowedRouters[router]) revert RouterNotAllowed(router);

        uint256 balanceBefore = usdc.balanceOf(address(this));

        // forceApprove resets to zero first, which USDT-style tokens require.
        inputToken.forceApprove(router, inputAmount);

        (bool success, bytes memory reason) = router.call(swapData);
        if (!success) revert SwapCallFailed(reason);

        // Leave no standing allowance behind: an aggregator that under-spends
        // must not keep the remainder approved.
        inputToken.forceApprove(router, 0);

        uint256 balanceAfter = usdc.balanceOf(address(this));
        usdcReceived = balanceAfter - balanceBefore;

        if (usdcReceived < minUsdcOut) revert InsufficientOutput(usdcReceived, minUsdcOut);

        emit SwapExecuted(address(inputToken), inputAmount, usdcReceived, router);
    }
}
