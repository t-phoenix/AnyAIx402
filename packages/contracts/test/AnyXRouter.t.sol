// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AnyXRouter} from "../src/AnyXRouter.sol";
import {FeeCollector} from "../src/FeeCollector.sol";
import {SwapExecutor} from "../src/SwapExecutor.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockERC20, MockRouter} from "./mocks/MockRouter.sol";

contract AnyXRouterTest is Test {
    AnyXRouter internal router;
    FeeCollector internal collector;
    MockUSDC internal usdc;
    MockERC20 internal weth;
    MockRouter internal dex;

    address internal owner = makeAddr("owner");
    address internal merchant = makeAddr("merchant");

    uint256 internal payerKey = 0xA11CE;
    address internal payer;

    /// @dev 1 USDC. x402 amounts are atomic units at 6 decimals.
    uint256 internal constant USDC_REQUIRED = 1_000_000;
    uint256 internal constant FEE_BPS = 20;
    uint256 internal constant INPUT_AMOUNT = 1 ether;

    function setUp() public {
        payer = vm.addr(payerKey);

        usdc = new MockUSDC();
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // 1 WETH buys 2 USDC, comfortably above what the payment needs.
        dex = new MockRouter(usdc, 2_000_000);

        collector = new FeeCollector(owner);
        router = new AnyXRouter(address(usdc), address(collector), FEE_BPS, owner);

        vm.prank(owner);
        router.setRouterAllowed(address(dex), true);

        weth.mint(payer, 100 ether);
        // The payer must hold the USDC their authorization transfers; AnyX
        // never fronts the settlement amount itself.
        usdc.mint(payer, 100_000_000);

        vm.prank(payer);
        weth.approve(address(router), type(uint256).max);
    }

    function _auth(uint256 value, address to, bytes32 nonce)
        internal
        view
        returns (AnyXRouter.PaymentAuthorization memory)
    {
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 300;

        bytes32 digest = usdc.hashAuthorization(payer, to, value, validAfter, validBefore, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerKey, digest);

        return AnyXRouter.PaymentAuthorization({
            payTo: to,
            usdcRequired: value,
            validAfter: validAfter,
            validBefore: validBefore,
            nonce: nonce,
            v: v,
            r: r,
            s: s
        });
    }

    function _swap(uint256 inputAmount) internal view returns (AnyXRouter.SwapParams memory) {
        return AnyXRouter.SwapParams({
            inputToken: IERC20(address(weth)),
            inputAmount: inputAmount,
            router: address(dex),
            swapData: abi.encodeCall(MockRouter.swap, (address(weth), inputAmount))
        });
    }

    // --- the happy path -----------------------------------------------------

    function test_swapAndPay_settlesExactAmountToMerchant() public {
        uint256 merchantBefore = usdc.balanceOf(merchant);

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(1)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        // The invariant that matters most: the merchant receives exactly the
        // amount the x402 challenge asked for. Not less, and not more.
        assertEq(usdc.balanceOf(merchant) - merchantBefore, USDC_REQUIRED);
    }

    function test_swapAndPay_takesFeeOnTopOfThePayment() public {
        uint256 expectedFee = (USDC_REQUIRED * FEE_BPS) / 10_000;

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(2)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        assertEq(usdc.balanceOf(address(collector)), expectedFee);
        // The fee came out of the swap proceeds, not out of the merchant's cut.
        assertEq(usdc.balanceOf(merchant), USDC_REQUIRED);
    }

    function test_swapAndPay_refundsSwapProceedsToThePayer() public {
        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 fee = (USDC_REQUIRED * FEE_BPS) / 10_000;
        uint256 swapOutput = (INPUT_AMOUNT * 2_000_000) / 1e18;

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(3)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        // Three things happen to the payer's USDC in one transaction:
        //   + the swap proceeds, less the AnyX fee, are refunded to them
        //   - the authorization moves usdcRequired out to the merchant
        // The authorization draws on the payer's own balance, so the refund has
        // to cover the payment; anything left over is theirs.
        uint256 expectedNet = (swapOutput - fee) - USDC_REQUIRED;
        assertEq(usdc.balanceOf(payer), payerBefore + expectedNet);

        // And nothing is left behind in the router.
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function test_swapAndPay_leavesNoBalanceInTheRouter() public {
        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(4)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(weth.balanceOf(address(router)), 0);
    }

    function test_swapAndPay_leavesNoStandingAllowance() public {
        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(5)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        assertEq(weth.allowance(address(router), address(dex)), 0);
    }

    function test_swapAndPay_emitsPaymentSettled() public {
        vm.expectEmit(true, true, true, true);
        emit AnyXRouter.PaymentSettled(
            payer,
            merchant,
            address(weth),
            INPUT_AMOUNT,
            USDC_REQUIRED,
            (USDC_REQUIRED * FEE_BPS) / 10_000,
            bytes32(uint256(6))
        );

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(6)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);
    }

    // --- slippage: the whole point ------------------------------------------

    function test_swapAndPay_revertsWhenSwapOutputIsShort() public {
        // 1 WETH now buys only 0.5 USDC, well below the payment.
        dex.setRate(500_000);

        uint256 fee = (USDC_REQUIRED * FEE_BPS) / 10_000;

        // Build the arguments before arming the cheatcode: _auth makes an
        // external staticcall, which would otherwise consume the expectation.
        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(7)));

        vm.expectRevert(
            abi.encodeWithSelector(
                SwapExecutor.InsufficientOutput.selector, 500_000, USDC_REQUIRED + fee
            )
        );
        vm.prank(payer);
        router.swapAndPay(sp, pa);
    }

    function test_swapAndPay_revertsWhenOutputCoversPaymentButNotFee() public {
        // Exactly the payment and not a unit more. Accepting this would mean
        // AnyX silently working for free, or worse, dipping into the merchant's
        // money to pay itself.
        dex.setRate(USDC_REQUIRED);

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(8)));
        vm.expectRevert();
        vm.prank(payer);
        router.swapAndPay(sp, pa);
    }

    function test_swapAndPay_payerKeepsFundsWhenSwapIsShort() public {
        dex.setRate(500_000);

        uint256 wethBefore = weth.balanceOf(payer);
        uint256 usdcBefore = usdc.balanceOf(payer);

        vm.prank(payer);
        try router.swapAndPay(
            _swap(INPUT_AMOUNT), _auth(USDC_REQUIRED, merchant, bytes32(uint256(9)))
        ) {
            revert("should have reverted");
        } catch {}

        // A failed payment must cost the payer nothing at all.
        assertEq(weth.balanceOf(payer), wethBefore);
        assertEq(usdc.balanceOf(payer), usdcBefore);
        assertEq(usdc.balanceOf(merchant), 0);
    }

    function test_swapAndPay_revertsWhenRouterDeliversNothing() public {
        dex.setShouldTakeTokensAndGiveNothing(true);

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(10)));
        vm.expectRevert();
        vm.prank(payer);
        router.swapAndPay(sp, pa);
    }

    function test_swapAndPay_revertsWhenRouterReverts() public {
        dex.setShouldRevert(true);

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(11)));
        vm.expectRevert();
        vm.prank(payer);
        router.swapAndPay(sp, pa);
    }

    function testFuzz_swapAndPay_neverUnderpaysTheMerchant(uint256 rate) public {
        // Any rate from far too low to generously high.
        rate = bound(rate, 1, 100_000_000);
        dex.setRate(rate);

        uint256 merchantBefore = usdc.balanceOf(merchant);

        vm.prank(payer);
        try router.swapAndPay(
            _swap(INPUT_AMOUNT), _auth(USDC_REQUIRED, merchant, bytes32(uint256(12)))
        ) {
            // If it succeeded, the merchant got exactly the full amount.
            assertEq(usdc.balanceOf(merchant) - merchantBefore, USDC_REQUIRED);
        } catch {
            // If it failed, the merchant got nothing. There is no third outcome
            // in which a partial payment lands.
            assertEq(usdc.balanceOf(merchant), merchantBefore);
        }
    }

    // --- authorization validation -------------------------------------------

    function test_swapAndPay_revertsOnExpiredAuthorization() public {
        AnyXRouter.PaymentAuthorization memory auth =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(13)));

        vm.warp(auth.validBefore + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                AnyXRouter.AuthorizationExpired.selector, auth.validBefore, block.timestamp
            )
        );
        vm.prank(payer);
        router.swapAndPay(_swap(INPUT_AMOUNT), auth);
    }

    function test_swapAndPay_revertsOnReusedNonce() public {
        bytes32 nonce = bytes32(uint256(14));

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa = _auth(USDC_REQUIRED, merchant, nonce);
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        AnyXRouter.SwapParams memory sp2 = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa2 = _auth(USDC_REQUIRED, merchant, nonce);
        vm.expectRevert(abi.encodeWithSelector(AnyXRouter.NonceAlreadyUsed.selector, nonce));
        vm.prank(payer);
        router.swapAndPay(sp2, pa2);
    }

    function test_swapAndPay_revertsWhenSignatureIsForADifferentRecipient() public {
        // A valid signature paired with a different payTo must not settle.
        AnyXRouter.PaymentAuthorization memory auth =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(15)));
        auth.payTo = makeAddr("attacker");

        vm.expectRevert();
        vm.prank(payer);
        router.swapAndPay(_swap(INPUT_AMOUNT), auth);
    }

    function test_swapAndPay_revertsWhenSignatureIsForADifferentAmount() public {
        AnyXRouter.PaymentAuthorization memory auth =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(16)));
        auth.usdcRequired = USDC_REQUIRED * 2;

        vm.expectRevert();
        vm.prank(payer);
        router.swapAndPay(_swap(INPUT_AMOUNT), auth);
    }

    function test_swapAndPay_revertsOnZeroRecipient() public {
        AnyXRouter.PaymentAuthorization memory auth =
            _auth(USDC_REQUIRED, address(0), bytes32(uint256(17)));

        vm.expectRevert(AnyXRouter.ZeroAddress.selector);
        vm.prank(payer);
        router.swapAndPay(_swap(INPUT_AMOUNT), auth);
    }

    function test_swapAndPay_revertsOnZeroAmount() public {
        AnyXRouter.SwapParams memory sp = _swap(0);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(18)));
        vm.expectRevert(AnyXRouter.ZeroAmount.selector);
        vm.prank(payer);
        router.swapAndPay(sp, pa);
    }

    // --- router allowlist ----------------------------------------------------

    function test_swapAndPay_revertsOnUnknownRouter() public {
        MockRouter rogue = new MockRouter(usdc, 2_000_000);

        AnyXRouter.SwapParams memory swap = _swap(INPUT_AMOUNT);
        swap.router = address(rogue);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(19)));

        vm.expectRevert(
            abi.encodeWithSelector(SwapExecutor.RouterNotAllowed.selector, address(rogue))
        );
        vm.prank(payer);
        router.swapAndPay(swap, pa);
    }

    function test_setRouterAllowed_isOwnerOnly() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        vm.prank(payer);
        router.setRouterAllowed(address(dex), false);
    }

    // --- fees ----------------------------------------------------------------

    function test_quoteFee_matchesWhatIsCharged() public {
        (uint256 fee, uint256 minOut) = router.quoteFee(USDC_REQUIRED);

        assertEq(fee, (USDC_REQUIRED * FEE_BPS) / 10_000);
        assertEq(minOut, USDC_REQUIRED + fee);

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(20)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        assertEq(usdc.balanceOf(address(collector)), fee);
    }

    function test_setFeeBps_cannotExceedTheHardCeiling() public {
        vm.expectRevert(
            abi.encodeWithSelector(AnyXRouter.FeeTooHigh.selector, 101, router.MAX_FEE_BPS())
        );
        vm.prank(owner);
        router.setFeeBps(101);
    }

    function test_setFeeBps_isOwnerOnly() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        vm.prank(payer);
        router.setFeeBps(50);
    }

    function test_constructor_rejectsFeeAboveTheCeiling() public {
        vm.expectRevert(abi.encodeWithSelector(AnyXRouter.FeeTooHigh.selector, 500, 100));
        new AnyXRouter(address(usdc), address(collector), 500, owner);
    }

    function test_zeroFeeStillSettles() public {
        vm.prank(owner);
        router.setFeeBps(0);

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(21)));
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        assertEq(usdc.balanceOf(merchant), USDC_REQUIRED);
        assertEq(usdc.balanceOf(address(collector)), 0);
    }

    // --- pausing and ownership ----------------------------------------------

    function test_pause_stopsNewPayments() public {
        vm.prank(owner);
        router.pause();

        AnyXRouter.SwapParams memory sp = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(22)));
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(payer);
        router.swapAndPay(sp, pa);

        vm.prank(owner);
        router.unpause();

        AnyXRouter.SwapParams memory sp2 = _swap(INPUT_AMOUNT);
        AnyXRouter.PaymentAuthorization memory pa2 =
            _auth(USDC_REQUIRED, merchant, bytes32(uint256(23)));
        vm.prank(payer);
        router.swapAndPay(sp2, pa2);
        assertEq(usdc.balanceOf(merchant), USDC_REQUIRED);
    }

    function test_ownershipTransferIsTwoStep() public {
        address next = makeAddr("next");

        vm.prank(owner);
        router.transferOwnership(next);

        // Still the old owner until the new one accepts: a typo cannot orphan
        // the contract.
        assertEq(router.owner(), owner);

        vm.prank(next);
        router.acceptOwnership();
        assertEq(router.owner(), next);
    }

    function test_rescueTokens_isOwnerOnly() public {
        weth.mint(address(router), 1 ether);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        vm.prank(payer);
        router.rescueTokens(address(weth), payer, 1 ether);

        vm.prank(owner);
        router.rescueTokens(address(weth), owner, 1 ether);
        assertEq(weth.balanceOf(owner), 1 ether);
    }
}
