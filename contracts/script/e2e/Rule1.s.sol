// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockPayer} from "../../src/mocks/MockPayer.sol";

/// @notice Rule 1 e2e origin step (Base Sepolia): the listed employer pays the user 100 USDC, then the unlisted one
///         pays 100 USDC. script/e2e/rule1.sh follows both through Lasna and checks the vault received exactly the
///         listed payment's share.
contract Rule1 is Script {
    uint256 internal constant PAYMENT = 100e6;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(key);
        IERC20 usdc = IERC20(vm.parseJsonAddress(vm.readFile("deployments/base-sepolia.json"), ".usdc"));
        string memory payers = vm.readFile("deployments/rule1-payers-base-sepolia.json");

        vm.startBroadcast(key);
        MockPayer(vm.parseJsonAddress(payers, ".listed")).pay(usdc, user, PAYMENT);
        MockPayer(vm.parseJsonAddress(payers, ".unlisted")).pay(usdc, user, PAYMENT);
        vm.stopBroadcast();

        console2.log("Paid the user 100 USDC from the listed and the unlisted employer");
    }
}
