// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {Heartbeat} from "../../src/Heartbeat.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {LogRecords} from "../helpers/LogRecords.sol";
import {RulebookFixture} from "../helpers/RulebookFixture.sol";

/// @notice Rule 2 scheduling and the Guardian state machine, on the Rulebook alone (callbacks are only recorded).
contract GuardianTest is RulebookFixture {
    uint256 internal deployedAt;

    function setUp() public {
        _deploySystem();
        vm.warp(1_800_000_000);
        deployedAt = block.timestamp;
        rulebook = _deployRulebook(_fullConfig());
    }

    function _state() internal view returns (Rulebook.GuardianState) {
        return rulebook.state();
    }

    /// @dev Ticks cron at `t` (absolute time).
    function _cronAt(uint256 t) internal {
        vm.warp(t);
        _cron();
    }

    function _toWarning() internal {
        _cronAt(deployedAt + SILENCE + CHECK_INTERVAL);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning));
    }

    // ------------------------------------------------------------------ subscriptions

    function test_G4_subscribesToActivityOnEveryWatchedChain() public view {
        // Rule 1, 2 x (Transfer, Approval) for 2 chains, Alive, Deposited, Withdrawn, Paused, Unpaused, cron.
        assertEq(sys.subscriptionCount(), 11);
        uint256 userTopic = uint256(uint160(user));
        MockSystem.Subscription memory unichainTransfer = sys.subscriptionAt(3);
        assertEq(unichainTransfer.chainId, UNICHAIN_SEPOLIA);
        assertEq(unichainTransfer.contractAddress, address(0), "any token");
        assertEq(unichainTransfer.topic0, LogRecords.TRANSFER_TOPIC);
        assertEq(unichainTransfer.topic1, userTopic, "from = user");
        assertEq(rulebook.watchedChains().length, 2);
        assertEq(rulebook.subscriptions().length, 11);
    }

    function test_constructorValidatesRule2AndGuardian() public {
        Rulebook.Config memory c = _fullConfig();
        c.vestingToken = address(0);
        vm.expectRevert(Rulebook.InvalidVesting.selector);
        _deployRulebook(c);

        c = _fullConfig();
        c.watchedChains = new uint256[](0);
        vm.expectRevert(Rulebook.InvalidGuardian.selector);
        _deployRulebook(c);

        c = _fullConfig();
        c.heartbeat = address(0);
        vm.expectRevert(Rulebook.ZeroAddress.selector);
        _deployRulebook(c);
    }

    // ------------------------------------------------------------------ Rule 2

    function test_C1_claimFiresOnInterval() public {
        _cronAt(deployedAt + CLAIM_INTERVAL - 1);
        assertEq(sys.callbackCount(), 0, "not yet");

        vm.expectEmit(address(rulebook));
        emit Rulebook.ClaimRequested(vesting, vestToken, 1);
        _cronAt(deployedAt + CLAIM_INTERVAL);
        assertEq(sys.callbackCount(), 1);
        assertEq(_selector(0), OrdersExecutor.claim.selector);
        assertEq(
            sys.callbackAt(0).payload,
            abi.encodeWithSelector(OrdersExecutor.claim.selector, address(0), user, vesting, vestToken, 1)
        );

        _cronAt(deployedAt + 2 * CLAIM_INTERVAL - 1);
        assertEq(sys.callbackCount(), 1, "one claim per interval");
        _cronAt(deployedAt + 2 * CLAIM_INTERVAL);
        assertEq(sys.callbackCount(), 2);
    }

    function test_C1_claimOffWhenNoVesting() public {
        Rulebook.Config memory c = _fullConfig();
        c.vesting = address(0);
        c.vestingToken = address(0);
        rulebook = _deployRulebook(c);
        _cronAt(block.timestamp + 10 * CLAIM_INTERVAL);
        // Only Guardian/cap work happened; no claim callback.
        for (uint256 i; i < sys.callbackCount(); ++i) {
            assertTrue(_selector(i) != OrdersExecutor.claim.selector);
        }
    }

    // ------------------------------------------------------------------ G-1 activity

    function test_G1_eachActivitySourceUpdatesClock() public {
        uint256 t = deployedAt;

        vm.warp(t += 1 days);
        _userTransfer(BASE_SEPOLIA, stranger);
        assertEq(rulebook.lastActive(BASE_SEPOLIA), t, "outgoing transfer on Base");

        vm.warp(t += 1 days);
        _react(LogRecords.approval(UNICHAIN_SEPOLIA, makeAddr("anyToken"), user, stranger, 1, ++txCounter));
        assertEq(rulebook.lastActive(UNICHAIN_SEPOLIA), t, "approval on Unichain");

        string[5] memory baseEvents = [
            "Alive(address)",
            "Deposited(address,address,uint256)",
            "Withdrawn(address,address,uint256)",
            "Paused(address)",
            "Unpaused(address)"
        ];
        address[5] memory emitters = [heartbeat, vault, vault, executor, executor];
        for (uint256 i; i < 5; ++i) {
            vm.warp(t += 1 days);
            _userEvent(BASE_SEPOLIA, emitters[i], baseEvents[i]);
            assertEq(rulebook.lastActiveAny(), t, baseEvents[i]);
        }
    }

    function test_G1_transferToVaultIsNotActivity() public {
        vm.warp(deployedAt + 1 days);
        _userTransfer(BASE_SEPOLIA, vault);
        assertEq(rulebook.lastActiveAny(), deployedAt);
        assertEq(rulebook.lastActive(BASE_SEPOLIA), 0);
    }

    function test_G1_otherSignalsAreNotActivity() public {
        vm.warp(deployedAt + 1 days);
        // Incoming money, transfers on an unwatched chain, someone else's heartbeat, and a vesting release.
        _pay(employer, 100e6);
        _react(LogRecords.transfer(1, makeAddr("anyToken"), user, stranger, 1, ++txCounter));
        _react(LogRecords.transfer(BASE_SEPOLIA, makeAddr("anyToken"), vesting, user, 1, ++txCounter));
        IReactive.LogRecord memory alive;
        alive.chainId = BASE_SEPOLIA;
        alive.contractAddress = heartbeat;
        alive.topic0 = uint256(keccak256("Alive(address)"));
        alive.topic1 = uint256(uint160(stranger));
        _react(alive);
        assertEq(rulebook.lastActiveAny(), deployedAt);
    }

    // ------------------------------------------------------------------ G-2 / G-3 state machine

    function test_G2_warningAfterSilence() public {
        _cronAt(deployedAt + SILENCE);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Active), "exactly the silence period is not past it");

        vm.expectEmit(address(rulebook));
        emit Rulebook.GuardianWarning(deployedAt + SILENCE + CHECK_INTERVAL, deployedAt);
        _cronAt(deployedAt + SILENCE + CHECK_INTERVAL);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning));
        assertEq(rulebook.warningSince(), deployedAt + SILENCE + CHECK_INTERVAL);
    }

    function test_G2_throttledByCheckInterval() public {
        uint256 checkedAt = deployedAt + SILENCE - 10;
        _cronAt(checkedAt); // a check runs here: silence not yet past, still Active
        assertEq(rulebook.lastGuardianCheck(), checkedAt);

        // Silence is now past, but the next check is not due until checkedAt + 1 hour: the tick does nothing.
        _cronAt(deployedAt + SILENCE + 10);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Active));
        assertEq(rulebook.lastGuardianCheck(), checkedAt);

        _cronAt(checkedAt + CHECK_INTERVAL);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning));
    }

    function test_G2_mostTicksExitAfterOneComparison() public {
        // An idle tick (nothing due) costs a fraction of a tick that does Guardian + claim work, and changes nothing.
        vm.warp(deployedAt + 10);
        uint256 idle = _tickGas();
        assertEq(rulebook.lastGuardianCheck(), deployedAt, "idle tick did no work");

        vm.warp(deployedAt + CLAIM_INTERVAL);
        uint256 busy = _tickGas();
        assertEq(rulebook.lastGuardianCheck(), deployedAt + CLAIM_INTERVAL);
        assertLt(idle * 3, busy, "an idle tick must stay cheap");
    }

    function _tickGas() internal returns (uint256 used) {
        IReactive.LogRecord memory log = LogRecords.cron(LASNA, ReactiveConstants.CRON100, 1);
        vm.prank(ReactiveConstants.SYSTEM);
        uint256 gasBefore = gasleft();
        rulebook.react(log);
        used = gasBefore - gasleft();
    }

    function test_G3_activityClearsWarning() public {
        _toWarning();
        vm.expectEmit(address(rulebook));
        emit Rulebook.GuardianCleared(UNICHAIN_SEPOLIA, txCounter + 1);
        _userTransfer(UNICHAIN_SEPOLIA, stranger);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Active));
        assertEq(rulebook.warningSince(), 0);
    }

    function test_G2_releaseOnlyAfterGrace() public {
        _toWarning();
        uint256 warnedAt = rulebook.warningSince();

        _cronAt(warnedAt + GRACE);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning), "exactly the grace period is not past it");
        assertEq(sys.callbackCount(), _claimsSoFar());

        vm.expectEmit(address(rulebook));
        emit Rulebook.GuardianReleased(rulebook.nonce() + 1);
        _cronAt(warnedAt + GRACE + CHECK_INTERVAL);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Released));

        MockSystem.CallbackRequest memory cb = sys.callbackAt(sys.callbackCount() - 1);
        assertEq(bytes4(cb.payload), OrdersExecutor.release.selector);
        assertEq(cb.recipient, executor);
    }

    function test_G2_releaseWithClaimOffSendsOnlyUsdc() public {
        Rulebook.Config memory c = _fullConfig();
        c.vesting = address(0);
        c.vestingToken = address(0);
        rulebook = _deployRulebook(c);
        deployedAt = block.timestamp;

        _toWarning();
        _cronAt(rulebook.warningSince() + GRACE + CHECK_INTERVAL);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Released));

        MockSystem.CallbackRequest memory cb = sys.callbackAt(sys.callbackCount() - 1);
        assertEq(bytes4(cb.payload), OrdersExecutor.release.selector);
        bytes memory args = new bytes(cb.payload.length - 4);
        for (uint256 i; i < args.length; ++i) {
            args[i] = cb.payload[i + 4];
        }
        (,, address[] memory tokens,) = abi.decode(args, (address, address, address[], uint256));
        assertEq(tokens.length, 1);
        assertEq(tokens[0], usdc);
    }

    function test_G2_releaseNeverInOneStep() public {
        // Even after a silence far longer than silence + grace, the first check only warns.
        _cronAt(deployedAt + 10 * (SILENCE + GRACE));
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning));
        _cronAt(block.timestamp + GRACE + CHECK_INTERVAL);
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Released));
    }

    function test_G2_releasedIsFinalAndUnsubscribesEverything() public {
        _toWarning();
        _cronAt(rulebook.warningSince() + GRACE + CHECK_INTERVAL);
        assertEq(sys.unsubscriptionCount(), sys.subscriptionCount());
        for (uint256 i; i < sys.subscriptionCount(); ++i) {
            assertEq(abi.encode(sys.unsubscriptionAt(i)), abi.encode(sys.subscriptionAt(i)));
        }

        uint256 callbacks = sys.callbackCount();
        _userTransfer(BASE_SEPOLIA, stranger);
        _pay(employer, 100e6);
        _cronAt(block.timestamp + 365 days);
        rulebook.checkNow();
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Released));
        assertEq(sys.callbackCount(), callbacks);
    }

    // ------------------------------------------------------------------ G-5 checkNow

    function test_G5_checkNowAdvancesState() public {
        // No cron at all: a stranger's checkNow moves the Guardian along by timestamps.
        vm.warp(deployedAt + SILENCE + 1);
        vm.prank(stranger);
        rulebook.checkNow();
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning));

        vm.warp(block.timestamp + GRACE);
        rulebook.checkNow();
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning), "grace not past yet");

        vm.warp(block.timestamp + 1);
        rulebook.checkNow();
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Released));
    }

    function test_G5_checkNowDoesNothingEarly() public {
        vm.warp(deployedAt + SILENCE);
        rulebook.checkNow();
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Active));
        assertEq(sys.callbackCount(), 0);
    }

    // ------------------------------------------------------------------ U-3 pause

    function test_U3_noCallbacksWhilePaused() public {
        vm.expectEmit(address(rulebook));
        emit Rulebook.PauseSeen(true);
        _userEvent(BASE_SEPOLIA, executor, "Paused(address)");
        assertTrue(rulebook.paused());
        assertEq(rulebook.lastActiveAny(), block.timestamp, "pausing is activity");

        _pay(employer, 100e6);
        _cronAt(deployedAt + 3 * CLAIM_INTERVAL);
        _cronAt(deployedAt + SILENCE + GRACE + 10 * CHECK_INTERVAL);
        _cronAt(deployedAt + SILENCE + 2 * GRACE + 20 * CHECK_INTERVAL);
        assertEq(sys.callbackCount(), 0, "no split, claim or release");
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Warning), "release waits");

        _userEvent(BASE_SEPOLIA, executor, "Unpaused(address)");
        assertFalse(rulebook.paused());
        assertEq(uint256(_state()), uint256(Rulebook.GuardianState.Active), "unpausing is activity");
        _pay(employer, 100e6);
        assertEq(sys.callbackCount(), 1);
    }

    function test_heartbeatEmitsAliveForTheCaller() public {
        Heartbeat hb = new Heartbeat();
        vm.expectEmit(address(hb));
        emit Heartbeat.Alive(user);
        vm.prank(user);
        hb.alive();
    }

    function _claimsSoFar() internal view returns (uint256 n) {
        for (uint256 i; i < sys.callbackCount(); ++i) {
            if (_selector(i) == OrdersExecutor.claim.selector) n++;
        }
    }
}
