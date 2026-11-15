// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice Phase 1 origin step for the wildcard probe: one Approval and one Transfer by the deployer on a token the
///         probe never named (a freshly deployed MockUSDC), so only a contract wildcard can match them.
/// @dev Usage: forge script script/e2e/WildcardActivity.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
contract WildcardActivity is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        MockUSDC token = new MockUSDC();
        token.mint(vm.addr(key), 10e6);
        token.approve(address(0xBEEF), 1e6);
        token.transfer(address(0xdEaD), 1e6);
        vm.stopBroadcast();
    }
}
