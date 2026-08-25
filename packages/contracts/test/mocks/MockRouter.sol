// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice A DEX aggregator router that can be told exactly how to misbehave.
/// @dev The router is the untrusted party in the swap. Being able to make it
///      under-deliver, deliver nothing, or revert is the point: those are the
///      cases the router contract has to survive.
contract MockRouter {
    MockUSDC public immutable usdc;

    /// @notice USDC minted per unit of input pulled, scaled by 1e18.
    uint256 public rate;
    bool public shouldRevert;
    bool public shouldTakeTokensAndGiveNothing;

    constructor(MockUSDC usdc_, uint256 rate_) {
        usdc = usdc_;
        rate = rate_;
    }

    function setRate(uint256 newRate) external {
        rate = newRate;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function setShouldTakeTokensAndGiveNothing(bool value) external {
        shouldTakeTokensAndGiveNothing = value;
    }

    /// @notice Stands in for the opaque calldata a real aggregator returns.
    function swap(address inputToken, uint256 inputAmount) external {
        if (shouldRevert) revert("router: swap failed");

        IERC20(inputToken).transferFrom(msg.sender, address(this), inputAmount);

        if (shouldTakeTokensAndGiveNothing) return;

        uint256 out = (inputAmount * rate) / 1e18;
        usdc.mint(msg.sender, out);
    }
}
