// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";

/// @notice Mainnet showcase, step 1 of `script/e2e/showcase.sh`: a real OpenZeppelin `VestingWallet` on Base that
///         vests a little USDC to this wallet over a few hours, so Rule 2 can claim it on mainnet.
/// @dev Env: VESTING_AMOUNT [0.5 USDC, 6 decimals], VESTING_DELAY [5 minutes], VESTING_DURATION [3 hours].
///      Writes deployments/showcase-base.json. Needs STEWARD_MAINNET_APPROVED=true, like every mainnet script.
contract ShowcaseVesting is Script {
    function run() external {
        require(block.chainid == 8453, "ShowcaseVesting: Base mainnet only");
        require(vm.envOr("STEWARD_MAINNET_APPROVED", false), "ShowcaseVesting: mainnet needs explicit approval");
        uint256 key = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(key);

        string memory base = vm.readFile("deployments/base.json");
        IERC20 usdc = IERC20(vm.parseJsonAddress(base, ".usdc"));
        uint256 amount = vm.envOr("VESTING_AMOUNT", uint256(0.5e6));
        uint64 start = uint64(block.timestamp + vm.envOr("VESTING_DELAY", uint256(5 minutes)));
        uint64 duration = uint64(vm.envOr("VESTING_DURATION", uint256(3 hours)));
        require(usdc.balanceOf(user) >= amount, "ShowcaseVesting: not enough USDC in this wallet");

        vm.startBroadcast(key);
        VestingWallet vesting = new VestingWallet(user, start, duration);
        require(usdc.transfer(address(vesting), amount), "ShowcaseVesting: USDC transfer failed");
        vm.stopBroadcast();

        console2.log("VestingWallet", address(vesting));
        console2.log("beneficiary  ", user);
        console2.log("USDC vesting ", amount);
        console2.log("start, end   ", start, start + duration);

        string memory j = "showcase";
        vm.serializeAddress(j, "user", user);
        vm.serializeAddress(j, "token", address(usdc));
        vm.serializeUint(j, "amount", amount);
        vm.serializeUint(j, "start", start);
        vm.serializeUint(j, "duration", duration);
        string memory out = vm.serializeAddress(j, "vesting", address(vesting));
        vm.writeJson(out, "deployments/showcase-base.json");
    }
}
