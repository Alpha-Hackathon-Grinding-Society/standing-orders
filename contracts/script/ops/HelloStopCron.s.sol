// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {HelloReactive} from "../../src/hello/HelloReactive.sol";

/// @notice Stops HelloReactive's cron subscription once enough ticks are measured, so it stops spending lREACT.
/// @dev Usage: forge script script/ops/HelloStopCron.s.sol --rpc-url $LASNA_RPC --broadcast
contract HelloStopCron is Script {
    function run() external {
        HelloReactive hello =
            HelloReactive(payable(vm.parseJsonAddress(vm.readFile("deployments/hello-lasna.json"), ".helloReactive")));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        hello.stopCron();
        vm.stopBroadcast();
        console2.log("Cron stopped after ticks:", hello.tickCount());
    }
}
