// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {WildcardProbe} from "../../src/hello/WildcardProbe.sol";

/// @notice Phase 1: deploy WildcardProbe on Lasna, watching the deployer's Transfer/Approval on any Base Sepolia token.
/// @dev Usage: forge script script/hello/DeployWildcardProbe.s.sol --rpc-url $LASNA_RPC --broadcast
contract DeployWildcardProbe is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(key);
        uint256 originChainId = vm.envUint("BASE_SEPOLIA_CHAIN_ID");
        uint256 funding = vm.envOr("PROBE_FUNDING_WEI", uint256(0.3 ether));

        vm.startBroadcast(key);
        WildcardProbe probe = new WildcardProbe{value: funding}(originChainId, user);
        vm.stopBroadcast();

        console2.log("WildcardProbe", address(probe));
        string memory j = "probe";
        vm.serializeUint(j, "deployBlock", block.number);
        vm.serializeAddress(j, "user", user);
        string memory out = vm.serializeAddress(j, "wildcardProbe", address(probe));
        vm.writeJson(out, "deployments/hello-wildcard-lasna.json");
    }
}
