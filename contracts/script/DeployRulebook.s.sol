// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {Rulebook} from "../src/Rulebook.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ReactiveConstants} from "../src/libraries/ReactiveConstants.sol";

/// @notice Deploys one user's Rulebook on Reactive (Lasna or mainnet) from that user's wallet (F-1), pointing at the
///         vault address `VaultFactory.predictVault(user)` will give them on Base. Run before CreateVault.
/// @dev Settings come from the environment (defaults in brackets; see .env.example):
///      Rule 1: INCOME_SENDERS [none], SPLIT_BPS [2000], PERIOD_CAP [100e6], PERIOD_LENGTH [30 days].
///      Rule 2: VESTING [off], VESTING_TOKEN, CLAIM_INTERVAL [1 day].
///      Guardian: SILENCE_PERIOD [90 days; 0 = off], GRACE_PERIOD [14 days], GUARDIAN_CHECK_INTERVAL [1 hour],
///      WATCHED_CHAINS [Base Sepolia + Unichain Sepolia on Lasna; Base + Arbitrum on mainnet].
///      RULEBOOK_CRON [Cron100 on Lasna, Cron1000 on mainnet; 0 = none], RULEBOOK_FUNDING_WEI [0.5 ether].
///      RULEBOOK_OUT [rulebook-lasna | rulebook-reactive]: the deployments/<name>.json this run writes, so a second
///      wallet's Rulebook never overwrites the first one's record.
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

        string memory base = vm.readFile(string.concat("deployments/", mainnet ? "base" : "base-sepolia", ".json"));
        address factory = vm.parseJsonAddress(base, ".vaultFactory");

        // Read the predicted vault from Base, then come back to Reactive to deploy.
        uint256 reactiveFork = vm.activeFork();
        vm.selectFork(vm.createFork(vm.envString(mainnet ? "BASE_RPC" : "BASE_SEPOLIA_RPC")));
        address vault = VaultFactory(factory).predictVault(user);
        address existing = VaultFactory(factory).vaultOf(user);
        vm.selectFork(reactiveFork);
        require(existing == address(0), "DeployRulebook: this wallet already has a vault and a registered Rulebook");

        Rulebook.Config memory config = _config(base, vault, mainnet);
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
        vm.serializeUint(j, "deployedAt", block.timestamp);
        vm.serializeAddress(j, "user", user);
        vm.serializeAddress(j, "vault", vault);
        vm.serializeAddress(j, "vesting", config.vesting);
        vm.serializeAddress(j, "vestingToken", config.vestingToken);
        vm.serializeUint(j, "silencePeriod", config.silencePeriod);
        vm.serializeUint(j, "gracePeriod", config.gracePeriod);
        vm.serializeUint(j, "cronTopic", config.cronTopic);
        string memory out = vm.serializeAddress(j, "rulebook", address(rulebook));
        string memory name = vm.envOr("RULEBOOK_OUT", string(mainnet ? "rulebook-reactive" : "rulebook-lasna"));
        vm.writeJson(out, string.concat("deployments/", name, ".json"));
    }

    function _config(string memory base, address vault, bool mainnet) internal view returns (Rulebook.Config memory) {
        uint256 baseChain = vm.parseJsonUint(base, ".chainId");
        uint256[] memory defaultChains = new uint256[](2);
        defaultChains[0] = baseChain;
        defaultChains[1] = mainnet ? 42_161 : 1301; // Arbitrum : Unichain Sepolia

        return Rulebook.Config({
            chainId: baseChain,
            token: vm.parseJsonAddress(base, ".usdc"),
            executor: vm.parseJsonAddress(base, ".ordersExecutor"),
            vault: vault,
            heartbeat: vm.parseJsonAddress(base, ".heartbeat"),
            splitBps: uint16(vm.envOr("SPLIT_BPS", uint256(2000))),
            periodCap: vm.envOr("PERIOD_CAP", uint256(100e6)),
            periodLength: vm.envOr("PERIOD_LENGTH", uint256(30 days)),
            incomeSenders: vm.envOr("INCOME_SENDERS", ",", new address[](0)),
            vesting: vm.envOr("VESTING", address(0)),
            vestingToken: vm.envOr("VESTING_TOKEN", address(0)),
            claimInterval: vm.envOr("CLAIM_INTERVAL", uint256(1 days)),
            watchedChains: vm.envOr("WATCHED_CHAINS", ",", defaultChains),
            silencePeriod: vm.envOr("SILENCE_PERIOD", uint256(90 days)),
            gracePeriod: vm.envOr("GRACE_PERIOD", uint256(14 days)),
            guardianCheckInterval: vm.envOr("GUARDIAN_CHECK_INTERVAL", uint256(1 hours)),
            cronTopic: vm.envOr("RULEBOOK_CRON", mainnet ? ReactiveConstants.CRON1000 : ReactiveConstants.CRON100)
        });
    }
}
