// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IUSDC {
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
}

interface ISwapRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external returns (uint256 amountOut);
}

/**
 * @title AnyXRouter
 * @notice Universal x402 multi-token router. Swaps any token to USDC and settles payment.
 */
contract AnyXRouter {
    address public immutable usdc;
    address public feeCollector;
    address public owner;
    uint256 public feeBps; // default 20 = 0.20%

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

    modifier onlyOwner() {
        require(msg.sender == owner, "AnyXRouter: caller is not the owner");
        _;
    }

    constructor(address _usdc, address _feeCollector, uint256 _feeBps) {
        require(_usdc != address(0), "Invalid USDC");
        require(_feeCollector != address(0), "Invalid FeeCollector");
        usdc = _usdc;
        feeCollector = _feeCollector;
        feeBps = _feeBps;
        owner = msg.sender;
    }

    function setFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 100, "Fee cannot exceed 1%");
        emit FeeUpdated(feeBps, _newFeeBps);
        feeBps = _newFeeBps;
    }

    function setFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid collector");
        emit FeeCollectorUpdated(feeCollector, _newCollector);
        feeCollector = _newCollector;
    }

    /**
     * @notice Execute direct USDC payment with EIP-3009
     */
    function directPayWithAuthorization(
        address payTo,
        uint256 usdcAmount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        IUSDC(usdc).transferWithAuthorization(
            msg.sender,
            payTo,
            usdcAmount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        emit PaymentSettled(msg.sender, payTo, usdc, usdcAmount, usdcAmount, 0, nonce);
    }
}
