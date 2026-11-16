// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {console2} from "forge-std/Script.sol";
import {DeployRulebook} from "../DeployRulebook.s.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";

/// @notice Prepares the phone setup page (web/setup) for a wallet that signs in MetaMask instead of with a key here.
///         Run against Base (or Base Sepolia). Writes deployments/setup-{base|base-sepolia}.json with everything the
///         page needs: the Rulebook's deploy bytecode with this user's settings (same env settings and defaults as
///         DeployRulebook), the predicted vault, and the permit and createVault details.
/// @dev Env: SETUP_USER (the phone wallet, required), BENEFICIARY (required), PERMIT_CAP [100e6], plus every
///      DeployRulebook setting. Signs nothing and sends nothing.
///      forge script script/ops/SetupPage.s.sol --tc SetupPage --sig "page()" --rpc-url $BASE_RPC
contract SetupPage is DeployRulebook {
    function page() external {
        bool mainnet = block.chainid == 8453;
        require(mainnet || block.chainid == 84_532, "SetupPage: run against Base or Base Sepolia");
        string memory net = mainnet ? "base" : "base-sepolia";
        string memory base = vm.readFile(string.concat("deployments/", net, ".json"));
        address user = vm.envAddress("SETUP_USER");
        VaultFactory factory = VaultFactory(vm.parseJsonAddress(base, ".vaultFactory"));
        require(factory.vaultOf(user) == address(0), "SetupPage: this wallet already has a vault on this factory");

        address vault = factory.predictVault(user);
        Rulebook.Config memory config = _config(base, vault, mainnet);
        bytes memory initcode = abi.encodePacked(type(Rulebook).creationCode, abi.encode(config));
        address usdc = config.token;

        string memory j = "setup";
        vm.serializeString(j, "network", mainnet ? "mainnet" : "testnet");
        vm.serializeAddress(j, "user", user);
        vm.serializeUint(j, "baseChainId", block.chainid);
        vm.serializeString(j, "baseName", mainnet ? "Base" : "Base Sepolia");
        vm.serializeString(j, "baseRpc", mainnet ? "https://mainnet.base.org" : "https://sepolia.base.org");
        vm.serializeString(j, "baseExplorer", mainnet ? "https://basescan.org" : "https://sepolia.basescan.org");
        vm.serializeUint(j, "reactiveChainId", mainnet ? 1597 : 5_318_007);
        vm.serializeString(j, "reactiveName", mainnet ? "Reactive Mainnet" : "Reactive Lasna");
        vm.serializeString(j, "reactiveRpc", mainnet ? "https://mainnet-rpc.rnk.dev/" : "https://lasna-rpc.rnk.dev/");
        vm.serializeString(j, "reactiveExplorer", mainnet ? "https://reactscan.net" : "https://lasna.reactscan.net");
        vm.serializeString(j, "reactiveSymbol", mainnet ? "REACT" : "lREACT");
        vm.serializeBytes(j, "rulebookInitcode", initcode);
        vm.serializeString(j, "rulebookValueWei", vm.toString(vm.envOr("RULEBOOK_FUNDING_WEI", uint256(0.5 ether))));
        vm.serializeAddress(j, "factory", address(factory));
        vm.serializeAddress(j, "executor", address(factory.executor()));
        vm.serializeAddress(j, "vault", vault);
        vm.serializeAddress(j, "usdc", usdc);
        vm.serializeString(j, "usdcName", _str(usdc, "name()"));
        vm.serializeString(j, "usdcVersion", mainnet ? _str(usdc, "version()") : "1");
        vm.serializeUint(j, "permitValue", vm.envOr("PERMIT_CAP", uint256(100e6)));
        vm.serializeAddress(j, "beneficiary", vm.envAddress("BENEFICIARY"));
        vm.serializeBytes32(j, "createVaultSelector", bytes32(VaultFactory.createVault.selector));
        vm.serializeUint(j, "splitBps", config.splitBps);
        vm.serializeUint(j, "periodCap", config.periodCap);
        vm.serializeUint(j, "periodDays", config.periodLength / 1 days);
        vm.serializeAddress(j, "incomeSenders", config.incomeSenders);
        vm.serializeUint(j, "silenceDays", config.silencePeriod / 1 days);
        vm.serializeUint(j, "graceDays", config.gracePeriod / 1 days);
        string memory out = vm.serializeUint(j, "watchedChains", config.watchedChains);
        vm.writeJson(out, string.concat("deployments/setup-", net, ".json"));

        console2.log("setup page data for", user, "-> predicted vault", vault);
    }

    function _str(address target, string memory sig) internal view returns (string memory) {
        (bool ok, bytes memory ret) = target.staticcall(abi.encodeWithSignature(sig));
        require(ok, "SetupPage: token call failed");
        return abi.decode(ret, (string));
    }
}
