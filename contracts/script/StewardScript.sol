// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {OrdersExecutor} from "../src/OrdersExecutor.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {Heartbeat} from "../src/Heartbeat.sol";
import {Rulebook} from "../src/Rulebook.sol";

/// @title Shared helpers for ops scripts: the caller's key and the deployed addresses for the current network.
/// @dev Base-side scripts run on Base or Base Sepolia; Reactive-side ones on Reactive mainnet or Lasna. Mainnet
///      needs STEWARD_MAINNET_APPROVED=true, like every deploy script.
abstract contract StewardScript is Script {
    function _key() internal view returns (uint256 key) {
        key = vm.envUint("PRIVATE_KEY");
        require(!_isMainnet() || vm.envOr("STEWARD_MAINNET_APPROVED", false), "mainnet needs STEWARD_MAINNET_APPROVED");
    }

    function _isMainnet() internal view returns (bool) {
        return block.chainid == 8453 || block.chainid == 1597;
    }

    function _base() internal view returns (string memory) {
        return vm.readFile(string.concat("deployments/", _isMainnet() ? "base" : "base-sepolia", ".json"));
    }

    function _executor() internal view returns (OrdersExecutor) {
        return OrdersExecutor(payable(vm.parseJsonAddress(_base(), ".ordersExecutor")));
    }

    function _heartbeat() internal view returns (Heartbeat) {
        return Heartbeat(vm.parseJsonAddress(_base(), ".heartbeat"));
    }

    function _usdc() internal view returns (address) {
        return vm.parseJsonAddress(_base(), ".usdc");
    }

    function _vault(address user) internal view returns (SavingsVault) {
        address vault = VaultFactory(vm.parseJsonAddress(_base(), ".vaultFactory")).vaultOf(user);
        require(vault != address(0), "this wallet has no vault on this network");
        return SavingsVault(vault);
    }

    function _rulebook() internal view returns (Rulebook) {
        string memory file = string.concat("deployments/rulebook-", _isMainnet() ? "reactive" : "lasna", ".json");
        return Rulebook(payable(vm.parseJsonAddress(vm.readFile(file), ".rulebook")));
    }
}
