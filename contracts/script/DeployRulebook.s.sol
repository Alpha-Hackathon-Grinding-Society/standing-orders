// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {Rulebook} from "../src/Rulebook.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ReactiveConstants} from "../src/libraries/ReactiveConstants.sol";

/// @notice Deploys one user's Rulebook on Reactive (Lasna or mainnet) from that user's wallet (F-1), pointing at the
///         vault address `VaultFactory.predictVault(user)` will give them on Base. Run before CreateVault.
/// @dev Settings come from the environment (defaults in brackets):
///      INCOME_SENDERS (comma-separated, required), SPLIT_BPS [2000], PERIOD_CAP [100e6], PERIOD_LENGTH [30 days],
///      RULEBOOK_CRON [Cron100 on Lasna, Cron1000 on mainnet; 0 = none], RULEBOOK_FUNDING_WEI [0.5 ether].
///      Usage: make deploy-rulebook-lasna
contract DeployRulebook is Script {
    uint256 internal constant REACTIVE_MAINNET = 1597;
    uint256 internal constant LASNA = 5_318_007;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(key);
        bool mainnet = block.chainid == REACTIVE_MAINNET;
        require(mainnet || block.chainid == LASNA, "DeployRulebook: run on Reactive mainnet or Lasna");
        require(
            !mainnet || vm.envOr("STEWARD_MAINNET_APPROVED", false), "DeployRulebook: mainnet needs explicit approval"
        );

        string memory network = mainnet ? "base" : "base-sepolia";
        string memory base = vm.readFile(string.concat("deployments/", network, ".json"));
        address factory = vm.parseJsonAddress(base, ".vaultFactory");

        // Read the predicted vault from Base, then come back to Reactive to deploy.
        uint256 reactiveFork = vm.activeFork();
        vm.selectFork(vm.createFork(vm.envString(mainnet ? "BASE_RPC" : "BASE_SEPOLIA_RPC")));
        address vault = VaultFactory(factory).predictVault(user);
        address existing = VaultFactory(factory).vaultOf(user);
        vm.selectFork(reactiveFork);
        require(existing == address(0), "DeployRulebook: this wallet already has a vault and a registered Rulebook");

        Rulebook.Config memory config = Rulebook.Config({
            chainId: vm.parseJsonUint(base, ".chainId"),
            token: vm.parseJsonAddress(base, ".usdc"),
            executor: vm.parseJsonAddress(base, ".ordersExecutor"),
            vault: vault,
            splitBps: uint16(vm.envOr("SPLIT_BPS", uint256(2000))),
            periodCap: vm.envOr("PERIOD_CAP", uint256(100e6)),
            periodLength: vm.envOr("PERIOD_LENGTH", uint256(30 days)),
            incomeSenders: vm.envAddress("INCOME_SENDERS", ","),
            cronTopic: vm.envOr("RULEBOOK_CRON", mainnet ? ReactiveConstants.CRON1000 : ReactiveConstants.CRON100)
        });
        uint256 funding = vm.envOr("RULEBOOK_FUNDING_WEI", uint256(0.5 ether));

        vm.startBroadcast(key);
        Rulebook rulebook = new Rulebook{value: funding}(config);
        vm.stopBroadcast();

        console2.log("Rulebook       ", address(rulebook));
        console2.log("owner (user)   ", user);
        console2.log("predicted vault", vault);

        string memory j = "rulebook";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeUint(j, "deployBlock", block.number);
        vm.serializeAddress(j, "user", user);
        vm.serializeAddress(j, "vault", vault);
        vm.serializeUint(j, "cronTopic", config.cronTopic);
        string memory out = vm.serializeAddress(j, "rulebook", address(rulebook));
        vm.writeJson(out, string.concat("deployments/rulebook-", mainnet ? "reactive" : "lasna", ".json"));
    }
}
