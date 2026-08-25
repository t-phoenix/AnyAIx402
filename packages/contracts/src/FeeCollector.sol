// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title FeeCollector
/// @notice Holds the AnyX swap spread until it is withdrawn.
/// @dev Separated from the router so fee custody and payment routing can be
///      owned by different keys, and so a router upgrade never touches accrued
///      revenue. Ownership transfer is two-step: a typo in an address should not
///      be able to lose the treasury.
contract FeeCollector is Ownable2Step {
    using SafeERC20 for IERC20;

    event FeesWithdrawn(address indexed token, address indexed to, uint256 amount);
    event PartnerCredited(bytes32 indexed partnerId, address indexed token, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();

    /// @notice Revenue attributed to an embedded integration partner.
    mapping(bytes32 partnerId => mapping(address token => uint256 amount)) public partnerCredits;

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    /// @notice Attributes part of a collected fee to a partner.
    /// @dev Accounting only. Settlement is a separate withdrawal, so a partner
    ///      cannot drain the contract by inflating a credit.
    function creditPartner(bytes32 partnerId, address token, uint256 amount) external onlyOwner {
        if (partnerId == bytes32(0)) revert ZeroAmount();
        partnerCredits[partnerId][token] += amount;
        emit PartnerCredited(partnerId, token, amount);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit FeesWithdrawn(token, to, amount);
    }

    function withdrawAll(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, balance);
        emit FeesWithdrawn(token, to, balance);
    }

    function balanceOf(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
