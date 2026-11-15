// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {Heartbeat} from "../src/Heartbeat.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Deploys Steward's shared Base contracts: VaultFactory (which deploys OrdersExecutor) and Heartbeat, plus
///         MockUSDC on testnet. Funds the executor with a small ETH float for callback fees (Design impact B).
///         Writes deployments/{base-sepolia|base}.json.
/// @dev Usage: make deploy-base-sepolia   (mainnet: make deploy-base, only after an explicit "deploy to mainnet")
contract DeployBase is Script {
    uint256 internal constant BASE = 8453;
    uint256 internal constant BASE_SEPOLIA = 84_532;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        bool mainnet = block.chainid == BASE;
        require(mainnet || block.chainid == BASE_SEPOLIA, "DeployBase: run on Base or Base Sepolia");
        require(!mainnet || vm.envOr("STEWARD_MAINNET_APPROVED", false), "DeployBase: mainnet needs explicit approval");

        address proxy = mainnet ? vm.envAddress("BASE_CALLBACK_PROXY") : vm.envAddress("BASE_SEPOLIA_CALLBACK_PROXY");
        require(proxy.code.length > 0, "DeployBase: callback proxy has no code on this chain");
        uint256 executorFloat = vm.envOr("EXECUTOR_FUNDING_WEI", uint256(0.001 ether));

        vm.startBroadcast(key);
        address usdc = mainnet ? vm.envAddress("BASE_USDC") : address(new MockUSDC());
        VaultFactory factory = new VaultFactory(IPayable(payable(proxy)));
        Heartbeat heartbeat = new Heartbeat();
        (bool ok,) = address(factory.executor()).call{value: executorFloat}("");
        require(ok, "DeployBase: funding the executor failed");
        vm.stopBroadcast();

        console2.log("VaultFactory  ", address(factory));
        console2.log("OrdersExecutor", address(factory.executor()));
        console2.log("Heartbeat     ", address(heartbeat));
        console2.log("USDC          ", usdc);

        string memory j = "base";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeUint(j, "deployBlock", block.number);
        vm.serializeAddress(j, "callbackProxy", proxy);
        vm.serializeAddress(j, "usdc", usdc);
        vm.serializeAddress(j, "vaultFactory", address(factory));
        vm.serializeAddress(j, "ordersExecutor", address(factory.executor()));
        string memory out = vm.serializeAddress(j, "heartbeat", address(heartbeat));
        vm.writeJson(out, string.concat("deployments/", mainnet ? "base" : "base-sepolia", ".json"));
    }
}
