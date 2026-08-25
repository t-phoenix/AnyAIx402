// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice Minimal view of a DEX aggregator router (1inch AggregationRouterV6,
///         0x Exchange Proxy). AnyX forwards opaque calldata built off-chain by
///         the aggregator's own API rather than modelling each router's ABI.
interface ISwapRouter {
    /// @dev Deliberately untyped: the aggregator's quote endpoint returns the
    ///      calldata, and the router validates it. AnyX validates the *outcome*
    ///      by measuring the USDC balance delta, which is the only guarantee
    ///      that actually matters.
    receive() external payable;
}

/// @notice Uniswap Permit2, for gasless ERC-20 approvals.
interface IPermit2 {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}
