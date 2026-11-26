// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {console2} from "forge-std/Script.sol";
import {StewardScript} from "../StewardScript.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice Testnet only: pays TO_ADDRESS some test USDC from this wallet, as an income sender would. If TO_ADDRESS
///         lists this wallet as an income sender, its Rulebook splits the payment into its vault a few seconds later.
/// @dev Env: TO_ADDRESS (required), PAY_AMOUNT in whole USDC [10]. MockUSDC's mint is open, so the wallet needs only
///      Base Sepolia ETH for gas. The mint lands in this wallet first, so the payment's `from` is this wallet.
contract PayTestUsdc is StewardScript {
    function run() external {
        require(block.chainid == 84_532, "test USDC exists on Base Sepolia only");
        address to = vm.envAddress("TO_ADDRESS");
        uint256 amount = vm.envOr("PAY_AMOUNT", uint256(10)) * 1e6;
        MockUSDC usdc = MockUSDC(_usdc());

        uint256 key = _key();
        vm.startBroadcast(key);
        usdc.mint(vm.addr(key), amount);
        usdc.transfer(to, amount);
        vm.stopBroadcast();

        console2.log("Paid test USDC (6 decimals):", amount);
        console2.log("From (list this as an income sender):", vm.addr(key));
        console2.log("To:", to);
    }
}
