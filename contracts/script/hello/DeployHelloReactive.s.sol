// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {HelloReactive} from "../../src/hello/HelloReactive.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";

/// @notice Phase 1, step 2: deploy HelloReactive on Lasna, funded with lREACT, at the address HelloReceiver expects.
/// @dev Usage: forge script script/hello/DeployHelloReactive.s.sol --rpc-url $LASNA_RPC --broadcast
contract DeployHelloReactive is Script {
    string internal constant IN = "deployments/hello-base-sepolia.json";
    string internal constant OUT = "deployments/hello-lasna.json";

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        uint256 funding = vm.envOr("HELLO_REACTIVE_FUNDING_WEI", uint256(1 ether));
        // Set HELLO_CRON_TOPIC=0 to skip the cron subscription (e.g. when ticks were already measured).
        uint256 cronTopic = vm.envOr("HELLO_CRON_TOPIC", ReactiveConstants.CRON10);

        string memory base = vm.readFile(IN);
        uint256 originChainId = vm.parseJsonUint(base, ".chainId");
        address usdc = vm.parseJsonAddress(base, ".mockUsdc");
        address receiver = vm.parseJsonAddress(base, ".helloReceiver");
        address predicted = vm.parseJsonAddress(base, ".predictedHelloReactive");

        require(
            vm.computeCreateAddress(deployer, vm.getNonce(deployer)) == predicted,
            "Lasna nonce moved: HelloReceiver expects a different HelloReactive address; redeploy DeployHelloBase"
        );

        vm.startBroadcast(key);
        HelloReactive hello = new HelloReactive{value: funding}(originChainId, usdc, originChainId, receiver, cronTopic);
        vm.stopBroadcast();

        console2.log("HelloReactive", address(hello));

        string memory j = "hello-lasna";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeUint(j, "deployBlock", block.number);
        vm.serializeUint(j, "cronTopic", cronTopic);
        string memory out = vm.serializeAddress(j, "helloReactive", address(hello));
        vm.writeJson(out, OUT);
    }
}
