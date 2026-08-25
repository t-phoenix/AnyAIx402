// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice USDC's FiatTokenV2_2 surface, limited to what AnyX needs.
/// @dev EIP-3009 is what makes x402 work: the payer signs off-chain and the
///      facilitator submits on-chain, so the payer never needs gas.
interface IUSDC is IERC20 {
    /// @notice Executes a transfer authorized by an off-chain EIP-712 signature.
    /// @param from Payer. Must be the signer of the authorization.
    /// @param to Recipient, taken from the x402 challenge's `payTo`.
    /// @param value Amount in USDC atomic units (6 decimals).
    /// @param validAfter Earliest Unix timestamp at which this may be submitted.
    /// @param validBefore Deadline. AnyX uses a 5-minute window.
    /// @param nonce Random 32 bytes. Not sequential; replay is prevented by
    ///        marking each nonce used.
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice True once an authorization nonce has been spent.
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);

    function version() external view returns (string memory);
}
