// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice Phase 1 origin step: mint test USDC to the deployer and send 100 of it, which HelloReactive should see.
/// @dev The origin tx hash is read from the broadcast file by script/e2e/hello.sh, which then follows the loop
///      through Lasna and back to Base Sepolia.
///      Usage: forge script script/e2e/Hello.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
contract Hello is Script {
    /// @dev Any address works; the test tokens just need to move.
    address internal constant RECIPIENT = 0x000000000000000000000000000000000000dEaD;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(vm.readFile("deployments/hello-base-sepolia.json"), ".mockUsdc"));

        vm.startBroadcast(key);
        usdc.mint(deployer, 1000e6);
        usdc.transfer(RECIPIENT, 100e6);
        vm.stopBroadcast();

        console2.log("Sent 100 test USDC from", deployer, "to", RECIPIENT);
    }
}
