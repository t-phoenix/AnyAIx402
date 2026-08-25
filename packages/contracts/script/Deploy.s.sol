// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AnyXRouter} from "../src/AnyXRouter.sol";
import {FeeCollector} from "../src/FeeCollector.sol";
import {ReservePool} from "../src/ReservePool.sol";

/// @notice Deploys the AnyX contract set and writes the addresses to disk.
///
/// @dev Usage:
///        forge script script/Deploy.s.sol:Deploy \
///          --rpc-url base_sepolia --broadcast --verify
///
///      Required environment: PRIVATE_KEY, USDC_ADDRESS.
///      Optional: FEE_BPS (default 20), OWNER (defaults to the deployer),
///      MAX_OUTSTANDING_USDC (default 10,000 USDC).
///
///      Deploy to Base Sepolia and exercise a real payment there before ever
///      pointing this at mainnet.
contract Deploy is Script {
    /// @notice Canonical USDC on Base mainnet.
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address usdc = vm.envOr("USDC_ADDRESS", USDC_BASE);
        address owner = vm.envOr("OWNER", deployer);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(20));
        uint256 maxOutstanding = vm.envOr("MAX_OUTSTANDING_USDC", uint256(10_000e6));

        require(usdc != address(0), "USDC_ADDRESS is required");

        console2.log("deployer     ", deployer);
        console2.log("owner        ", owner);
        console2.log("usdc         ", usdc);
        console2.log("feeBps       ", feeBps);
        console2.log("chainId      ", block.chainid);

        vm.startBroadcast(deployerKey);

        FeeCollector feeCollector = new FeeCollector(owner);
        AnyXRouter router = new AnyXRouter(usdc, address(feeCollector), feeBps, owner);
        ReservePool reservePool = new ReservePool(usdc, owner, maxOutstanding);

        vm.stopBroadcast();

        console2.log("FeeCollector ", address(feeCollector));
        console2.log("AnyXRouter   ", address(router));
        console2.log("ReservePool  ", address(reservePool));

        _writeDeployment(
            address(router), address(feeCollector), address(reservePool), usdc, owner, feeBps
        );

        console2.log("");
        console2.log("Next steps, none of which this script does for you:");
        console2.log(
            "  1. Allowlist your aggregator routers: router.setRouterAllowed(router, true)"
        );
        console2.log(
            "  2. Authorize the router on the pool: reservePool.setSpenderAllowed(router, true)"
        );
        console2.log("  3. Fund the pool with USDC and call depositFloat()");
        console2.log("  4. Transfer ownership to a multisig and accept it from that multisig");
        console2.log("  5. Set ANYX_ROUTER, FEE_COLLECTOR and RESERVE_POOL in your .env.local");
    }

    function _writeDeployment(
        address router,
        address feeCollector,
        address reservePool,
        address usdc,
        address owner,
        uint256 feeBps
    ) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "deployedAt": ',
            vm.toString(block.timestamp),
            ",\n",
            '  "anyxRouter": "',
            vm.toString(router),
            '",\n',
            '  "feeCollector": "',
            vm.toString(feeCollector),
            '",\n',
            '  "reservePool": "',
            vm.toString(reservePool),
            '",\n',
            '  "usdc": "',
            vm.toString(usdc),
            '",\n',
            '  "owner": "',
            vm.toString(owner),
            '",\n',
            '  "feeBps": ',
            vm.toString(feeBps),
            "\n",
            "}\n"
        );

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("wrote", path);
    }
}
