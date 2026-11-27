// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";

/// @notice Testnet only: sends native test funds (Base Sepolia ETH or Lasna lREACT) from this wallet, to fund a tester's
///         wallet or to buy lREACT at Reactive's faucet (a plain send to the faucet on Base Sepolia returns lREACT on
///         Lasna at about 100 per ETH; never more than 5 ETH in one send).
/// @dev Env: TO_ADDRESS (required), AMOUNT_WEI (required). Refuses any mainnet.
contract SendTestFunds is Script {
    function run() external {
        require(block.chainid == 84_532 || block.chainid == 5_318_007, "SendTestFunds: Base Sepolia or Lasna only");
        address to = vm.envAddress("TO_ADDRESS");
        uint256 amount = vm.envUint("AMOUNT_WEI");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "SendTestFunds: transfer failed");
        vm.stopBroadcast();

        console2.log("Sent (wei):", amount);
        console2.log("To:", to);
    }
}
