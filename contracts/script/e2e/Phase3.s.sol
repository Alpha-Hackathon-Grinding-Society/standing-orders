// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {MockToken} from "../../src/mocks/MockToken.sol";
import {MockVestingWallet} from "../../src/mocks/MockVestingWallet.sol";

// Origin-side steps of the Phase 3 testnet run (script/e2e/phase3.sh drives them in order).

/// @notice Base Sepolia: a vesting wallet (OpenZeppelin code) for the user, holding 1,000 VEST that vest over
///         VEST_DURATION seconds [600], starting now. Writes deployments/phase3-base-sepolia.json.
contract Phase3Vesting is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(key);
        uint64 duration = uint64(vm.envOr("VEST_DURATION", uint256(600)));

        vm.startBroadcast(key);
        MockToken vest = new MockToken("Steward Test Vesting Token", "VEST");
        MockVestingWallet wallet = new MockVestingWallet(user, uint64(block.timestamp), duration);
        vest.mint(address(wallet), 1000e18);
        vm.stopBroadcast();

        console2.log("VEST token     ", address(vest));
        console2.log("vesting wallet ", address(wallet));
        string memory j = "phase3";
        vm.serializeAddress(j, "vestToken", address(vest));
        string memory out = vm.serializeAddress(j, "vestingWallet", address(wallet));
        vm.writeJson(out, "deployments/phase3-base-sepolia.json");
    }
}

/// @notice Base Sepolia: the one-time approval that lets the executor move claimed VEST into the vault (C-2).
contract Phase3ApproveVesting is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        string memory p3 = vm.readFile("deployments/phase3-base-sepolia.json");
        address executor = vm.parseJsonAddress(vm.readFile("deployments/base-sepolia.json"), ".ordersExecutor");
        vm.startBroadcast(key);
        MockToken(vm.parseJsonAddress(p3, ".vestToken")).approve(executor, type(uint256).max);
        vm.stopBroadcast();
    }
}

/// @notice Unichain Sepolia: the user sends a token, which is signed activity on the second watched chain (G-4).
///         Deploys a throwaway test token, mints to the user and sends 1 of it.
contract Phase3UnichainActivity is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        MockToken token = new MockToken("Steward Test Token", "STT");
        token.mint(vm.addr(key), 10e18);
        token.transfer(0x000000000000000000000000000000000000dEaD, 1e18);
        vm.stopBroadcast();
    }
}
