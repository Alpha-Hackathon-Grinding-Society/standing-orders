// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {HelloReceiver} from "../../src/hello/HelloReceiver.sol";

/// @notice Phase 1, step 1: deploy MockUSDC and HelloReceiver on Base Sepolia.
/// @dev HelloReceiver must know HelloReactive's address before it exists (the library stores it immutably), so we
///      predict it from the deployer's next nonce on Lasna. Run DeployHelloReactive next, with no other Lasna tx in
///      between; that script checks the prediction.
///      Usage: forge script script/hello/DeployHelloBase.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
contract DeployHelloBase is Script {
    string internal constant OUT = "deployments/hello-base-sepolia.json";

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        address proxy = vm.envAddress("BASE_SEPOLIA_CALLBACK_PROXY");
        uint256 funding = vm.envOr("HELLO_RECEIVER_FUNDING_WEI", uint256(0.001 ether));

        uint256 baseFork = vm.activeFork();
        vm.selectFork(vm.createFork(vm.envString("LASNA_RPC")));
        uint64 lasnaNonce = vm.getNonce(deployer);
        vm.selectFork(baseFork);
        address predictedReactive = vm.computeCreateAddress(deployer, lasnaNonce);

        vm.startBroadcast(key);
        MockUSDC usdc = new MockUSDC();
        HelloReceiver receiver = new HelloReceiver{value: funding}(IPayable(payable(proxy)), predictedReactive);
        vm.stopBroadcast();

        console2.log("deployer          ", deployer);
        console2.log("MockUSDC          ", address(usdc));
        console2.log("HelloReceiver     ", address(receiver));
        console2.log("HelloReactive (predicted, Lasna nonce)", predictedReactive, lasnaNonce);

        string memory j = "hello-base";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeAddress(j, "deployer", deployer);
        vm.serializeAddress(j, "callbackProxy", proxy);
        vm.serializeAddress(j, "mockUsdc", address(usdc));
        vm.serializeAddress(j, "helloReceiver", address(receiver));
        vm.serializeUint(j, "lasnaNonce", lasnaNonce);
        string memory out = vm.serializeAddress(j, "predictedHelloReactive", predictedReactive);
        vm.writeJson(out, OUT);
    }
}
