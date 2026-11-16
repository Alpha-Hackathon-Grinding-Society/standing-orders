// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockPayer} from "../../src/mocks/MockPayer.sol";

/// @notice Rule 1 e2e, step 1 (Base Sepolia): deploys two test "employers", one to be listed as an income sender and
///         one not, each holding 1,000 test USDC. Writes deployments/rule1-payers-base-sepolia.json.
contract Rule1Payers is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(vm.readFile("deployments/base-sepolia.json"), ".usdc"));

        vm.startBroadcast(key);
        MockPayer listed = new MockPayer();
        MockPayer unlisted = new MockPayer();
        usdc.mint(address(listed), 1000e6);
        usdc.mint(address(unlisted), 1000e6);
        vm.stopBroadcast();

        console2.log("listed payer  ", address(listed));
        console2.log("unlisted payer", address(unlisted));
        string memory j = "payers";
        vm.serializeAddress(j, "listed", address(listed));
        string memory out = vm.serializeAddress(j, "unlisted", address(unlisted));
        vm.writeJson(out, "deployments/rule1-payers-base-sepolia.json");
    }
}
