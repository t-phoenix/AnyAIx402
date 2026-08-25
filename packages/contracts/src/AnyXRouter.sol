// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title AnyXRouter
/// @notice Phase 2: swap input token → USDC then settle x402 via EIP-3009.
/// v0 does not deploy this. See docs/PLAN.md and docs/AGENTS.md Task 2.1.
interface ISwapRouter {
    function swap(bytes calldata data) external returns (uint256 usdcOut);
}

contract AnyXRouter {
    address public immutable USDC_BASE;
    address public feeCollector;
    uint256 public feeBps;
    address public swapRouter;
    address public owner;

    event PaymentSettled(
        address indexed payer,
        address indexed recipient,
        uint256 inputAmount,
        address inputToken,
        uint256 usdcSettled,
        uint256 fee,
        bytes32 nonce
    );

    constructor(address usdc, address collector, address router_) {
        USDC_BASE = usdc;
        feeCollector = collector;
        swapRouter = router_;
        feeBps = 20;
        owner = msg.sender;
    }

    function setFeeBps(uint256 newFeeBps) external {
        require(msg.sender == owner, "only owner");
        require(newFeeBps <= 100, "max 1%");
        feeBps = newFeeBps;
    }

    /// @dev Implemented in Phase 2. v0 uses an off-chain USDC float + EIP-3009.
    function swapAndPay(
        address,
        uint256,
        uint256,
        bytes calldata,
        address,
        uint256,
        uint256,
        uint256,
        bytes32,
        uint8,
        bytes32,
        bytes32
    ) external pure {
        revert("AnyXRouter: Phase 2");
    }
}
