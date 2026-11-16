// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Rulebook} from "../../src/Rulebook.sol";
import {SavingsVault} from "../../src/SavingsVault.sol";
import {Heartbeat} from "../../src/Heartbeat.sol";
import {LogRecords} from "../helpers/LogRecords.sol";
import {StewardSystem} from "../helpers/StewardSystem.sol";

/// @notice All three rules end to end through the real Base contracts, in the real setup order.
contract StewardFlowTest is StewardSystem {
    function setUp() public {
        _deploySteward();
    }

    function test_rule1EndToEnd_listedSplitsUnlistedDoesNot() public {
        _payUser(100e6);
        // A stranger's payment is seen and ignored.
        usdc.mint(user, 100e6);
        _relay(LogRecords.transfer(BASE_SEPOLIA, address(usdc), makeAddr("stranger"), user, 100e6, 0));

        assertEq(_deliver(), 0);
        assertEq(usdc.balanceOf(address(vault)), 20e6);
        assertEq(usdc.balanceOf(user), 180e6);
    }

    function test_C2_claimMovesVestedToVault() public {
        _live(CLAIM_INTERVAL); // first claim check is due one interval after deployment
        uint256 expected = VESTED_TOTAL * CLAIM_INTERVAL / VEST_DURATION;
        assertEq(vestToken.balanceOf(address(vault)), expected);
        assertEq(vestToken.balanceOf(user), 0, "claimed tokens never stay in the wallet");
    }

    function test_V4_coldWalletGoesThroughVault() public {
        address cold = makeAddr("cold");
        vm.prank(user);
        vault.proposeColdWallet(cold);
        _userEvent(address(heartbeat), "Alive(address)"); // keep the Guardian calm while we wait
        vm.warp(block.timestamp + 24 hours);
        vm.prank(user);
        vault.applyColdWallet();

        _live(CLAIM_INTERVAL); // the first claim lands at deploy + 25 h, after the change took effect
        assertEq(vestToken.balanceOf(cold), VESTED_TOTAL * 25 hours / VEST_DURATION);
        assertEq(vestToken.balanceOf(address(vault)), 0);
    }

    function test_guardianFullCycleReleasesToBeneficiary() public {
        _payUser(100e6); // 20 USDC into the vault
        _deliver();

        _live(SILENCE + CHECK_INTERVAL);
        assertEq(uint256(rulebook.state()), uint256(Rulebook.GuardianState.Warning));
        assertEq(usdc.balanceOf(heir), 0, "warning alone never releases");

        _live(GRACE + CHECK_INTERVAL);
        assertEq(uint256(rulebook.state()), uint256(Rulebook.GuardianState.Released));
        assertEq(usdc.balanceOf(heir), 20e6);
        assertGt(vestToken.balanceOf(heir), 0, "claimed tokens go too");
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(vestToken.balanceOf(address(vault)), 0);
    }

    function test_G3_activityOnSecondChainClearsWarning() public {
        _live(SILENCE + CHECK_INTERVAL);
        assertEq(uint256(rulebook.state()), uint256(Rulebook.GuardianState.Warning));

        _relay(LogRecords.transfer(UNICHAIN_SEPOLIA, makeAddr("anyToken"), user, makeAddr("friend"), 1, 0));
        assertEq(uint256(rulebook.state()), uint256(Rulebook.GuardianState.Active));

        _live(GRACE + CHECK_INTERVAL);
        assertEq(uint256(rulebook.state()), uint256(Rulebook.GuardianState.Active), "cleared: grace no longer runs");
    }

    function test_G1_automatedMovesNeverCountAsActivity() public {
        uint256 before = rulebook.lastActiveAny();
        vm.warp(block.timestamp + 2 days);
        _payUser(100e6);
        _tick(); // claim
        _deliver();
        // What the network would also report: the executor's pull and the vesting release.
        _relay(LogRecords.transfer(BASE_SEPOLIA, address(usdc), user, address(vault), 20e6, 0));
        _relay(LogRecords.transfer(BASE_SEPOLIA, address(vestToken), address(vestingWallet), user, 1, 0));
        assertEq(rulebook.lastActiveAny(), before);
    }

    function test_U3_pausedUserGetsNoCallbacksAndNoRelease() public {
        vm.prank(user);
        executor.pause();
        _userEvent(address(executor), "Paused(address)");
        assertTrue(rulebook.paused());

        uint256 callbacks = sys.callbackCount();
        _payUser(100e6);
        _live(SILENCE + GRACE + 2 * CHECK_INTERVAL);
        assertEq(sys.callbackCount(), callbacks, "no split, claim or release while paused");
        assertEq(uint256(rulebook.state()), uint256(Rulebook.GuardianState.Warning), "release waits for unpause");

        // Withdraw still works while paused and in Warning (safety invariant 5).
        usdc.mint(address(vault), 5e6);
        vm.prank(user);
        vault.withdraw(address(usdc), 5e6);
    }
}
