// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractPayer} from "@reactive/src/base/AbstractPayer.sol";
import {Rulebook, RULEBOOK_CALLBACK_GAS} from "../../src/Rulebook.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {LogRecords} from "../helpers/LogRecords.sol";
import {RulebookFixture} from "../helpers/RulebookFixture.sol";

contract RulebookTest is RulebookFixture {
    function setUp() public {
        _deploySystem();
        rulebook = _deployRulebook(_config(ReactiveConstants.CRON100));
    }

    // ------------------------------------------------------------------ F-1, S-1: deployment and subscriptions

    function test_F1_rulebookOwnerIsTheDeployingWallet() public view {
        assertEq(rulebook.owner(), user);
        assertEq(rulebook.vault(), vault);
        assertEq(rulebook.executor(), executor);
    }

    function test_S1_subscribesToUsdcTransfersToTheUser() public view {
        assertEq(sys.subscriptionCount(), 4); // Rule 1, Paused, Unpaused, cron (Guardian off in this config)
        MockSystem.Subscription memory s = sys.subscriptionAt(0);
        assertEq(s.subscriber, address(rulebook));
        assertEq(s.chainId, BASE_SEPOLIA);
        assertEq(s.contractAddress, usdc);
        assertEq(s.topic0, LogRecords.TRANSFER_TOPIC);
        assertEq(s.topic1, IGNORE, "any sender; filtered in react");
        assertEq(s.topic2, uint256(uint160(user)), "to = user");
        assertEq(s.topic3, IGNORE);
    }

    function test_subscribesToTheChosenCron() public view {
        MockSystem.Subscription memory c = sys.subscriptionAt(sys.subscriptionCount() - 1);
        assertEq(c.chainId, LASNA);
        assertEq(c.contractAddress, ReactiveConstants.LEGACY_SYSTEM);
        assertEq(c.topic0, ReactiveConstants.CRON100);
    }

    function test_cronIsOptional() public {
        Rulebook rb = _deployRulebook(_config(0));
        assertEq(rb.cronTopic(), 0);
        assertEq(sys.subscriptionCount(), 7); // 4 from setUp + Rule 1, Paused, Unpaused (no cron)
    }

    function test_constructorValidatesConfig() public {
        Rulebook.Config memory c = _config(0);
        c.vault = address(0);
        vm.expectRevert(Rulebook.ZeroAddress.selector);
        _deployRulebook(c);

        c = _config(0);
        c.periodLength = 0;
        vm.expectRevert(Rulebook.InvalidPeriod.selector);
        _deployRulebook(c);

        c = _config(0);
        c.splitBps = 99;
        vm.expectRevert(abi.encodeWithSelector(Rulebook.InvalidSplitBps.selector, 99));
        _deployRulebook(c);

        c.splitBps = 5001;
        vm.expectRevert(abi.encodeWithSelector(Rulebook.InvalidSplitBps.selector, 5001));
        _deployRulebook(c);
    }

    // ------------------------------------------------------------------ S-2, S-3: the split

    function test_S1_S2_onlyListedSenderTriggersSplit() public {
        vm.expectEmit(address(rulebook));
        emit Rulebook.IncomeIgnored(1, stranger, 100e6);
        _pay(stranger, 100e6);
        assertEq(sys.callbackCount(), 0);

        vm.expectEmit(address(rulebook));
        emit Rulebook.SplitRequested(2, employer, 100e6, 20e6, 1);
        _pay(employer, 100e6);
        assertEq(sys.callbackCount(), 1);

        _pay(client, 50e6);
        assertEq(sys.callbackCount(), 2);
    }

    function test_S3_shareRespectsBps() public {
        _pay(employer, 100e6);
        (address forUser, address token, uint256 amount, uint256 nonce) = _lastSplit();
        assertEq(forUser, user);
        assertEq(token, usdc);
        assertEq(amount, 20e6); // 20% of 100
        assertEq(nonce, 1);

        _pay(employer, 12_345_678);
        (,, amount, nonce) = _lastSplit();
        assertEq(amount, 2_469_135); // 20%, rounded down
        assertEq(nonce, 2);
    }

    function test_S3_callbackGoesToTheExecutorWithEnoughGas() public {
        _pay(employer, 100e6);
        MockSystem.CallbackRequest memory cb = sys.callbackAt(0);
        assertEq(cb.requester, address(rulebook));
        assertEq(cb.chainId, BASE_SEPOLIA);
        assertEq(cb.recipient, executor);
        assertEq(cb.gasLimit, RULEBOOK_CALLBACK_GAS);
        assertEq(bytes4(cb.payload), OrdersExecutor.split.selector);
    }

    function test_S3_capLimitsTheSplitAndThenBlocksIt() public {
        _pay(employer, 1000e6); // share 200
        _pay(employer, 1000e6); // share 200, room 100
        (,, uint256 amount,) = _lastSplit();
        assertEq(amount, 100e6);
        assertEq(rulebook.splitThisPeriod(), PERIOD_CAP);

        vm.expectEmit(address(rulebook));
        emit Rulebook.CapReached(3, 1000e6, rulebook.periodStart());
        _pay(employer, 1000e6);
        assertEq(sys.callbackCount(), 2);
    }

    function test_S3_capResetsAfterPeriod() public {
        _pay(employer, 1500e6); // fills the 300 cap
        assertEq(rulebook.splitThisPeriod(), PERIOD_CAP);

        vm.warp(block.timestamp + PERIOD_LENGTH - 1);
        _cron();
        assertEq(rulebook.splitThisPeriod(), PERIOD_CAP, "not yet");

        vm.warp(block.timestamp + 1);
        vm.expectEmit(address(rulebook));
        emit Rulebook.PeriodReset(block.timestamp);
        _cron();
        assertEq(rulebook.splitThisPeriod(), 0);
        assertEq(rulebook.periodStart(), block.timestamp);

        _pay(employer, 100e6);
        (,, uint256 amount,) = _lastSplit();
        assertEq(amount, 20e6);
    }

    function test_S3_capResetsOnIncomeEvenIfCronIsLate() public {
        _pay(employer, 1500e6);
        vm.warp(block.timestamp + PERIOD_LENGTH);
        _pay(employer, 100e6); // no cron tick in between
        (,, uint256 amount, uint256 nonce) = _lastSplit();
        assertEq(amount, 20e6);
        assertEq(nonce, 2);
    }

    function test_S3_tinyIncomeRoundsToNothing() public {
        _pay(employer, 4); // 20% of 4 = 0.8 -> 0
        assertEq(sys.callbackCount(), 0);
        assertEq(rulebook.nonce(), 0);
    }

    function test_ignoresOtherTokensChainsAndRecipients() public {
        _react(LogRecords.transfer(BASE_SEPOLIA, makeAddr("otherToken"), employer, user, 100e6, 1));
        _react(LogRecords.transfer(1, usdc, employer, user, 100e6, 2));
        _react(LogRecords.transfer(BASE_SEPOLIA, usdc, employer, stranger, 100e6, 3));
        _react(LogRecords.cron(LASNA, ReactiveConstants.CRON1, 1)); // not our cron topic
        assertEq(sys.callbackCount(), 0);
    }

    function test_cronTickBeforePeriodEndDoesNothing() public {
        _pay(employer, 100e6);
        _cron();
        assertEq(rulebook.splitThisPeriod(), 20e6);
        assertEq(rulebook.periodStart(), 1);
    }

    function test_reactIsSystemOnly() public {
        vm.expectRevert(
            abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), ReactiveConstants.SYSTEM)
        );
        rulebook.react(LogRecords.transfer(BASE_SEPOLIA, usdc, employer, user, 1, 1));
    }

    // ------------------------------------------------------------------ editRules

    function test_editRulesReplacesShareCapAndSenders() public {
        address[] memory senders = new address[](1);
        senders[0] = stranger;
        vm.prank(user);
        rulebook.editRules(5000, 1000e6, senders);

        assertEq(rulebook.splitBps(), 5000);
        assertEq(rulebook.periodCap(), 1000e6);
        assertFalse(rulebook.isIncomeSender(employer));
        assertFalse(rulebook.isIncomeSender(client));
        assertTrue(rulebook.isIncomeSender(stranger));
        assertEq(rulebook.incomeSenders().length, 1);

        _pay(employer, 100e6);
        assertEq(sys.callbackCount(), 0);
        _pay(stranger, 100e6);
        (,, uint256 amount,) = _lastSplit();
        assertEq(amount, 50e6);
    }

    function test_editRulesLoweringCapBelowSavedLeavesNoRoom() public {
        _pay(employer, 1000e6); // 200 saved
        address[] memory senders = rulebook.incomeSenders();
        vm.prank(user);
        rulebook.editRules(SPLIT_BPS, 150e6, senders);
        assertEq(rulebook.splitThisPeriod(), 150e6);
        _pay(employer, 100e6);
        assertEq(sys.callbackCount(), 1);
    }

    function test_editRulesIsOwnerOnlyAndValidated() public {
        address[] memory senders = new address[](1);
        vm.prank(stranger);
        vm.expectRevert(Rulebook.NotOwner.selector);
        rulebook.editRules(2000, 1, senders);

        vm.startPrank(user);
        vm.expectRevert(Rulebook.ZeroAddress.selector);
        rulebook.editRules(2000, 1, senders); // senders[0] is address(0)
        vm.expectRevert(abi.encodeWithSelector(Rulebook.InvalidSplitBps.selector, 6000));
        rulebook.editRules(6000, 1, new address[](0));
        vm.stopPrank();
    }

    function test_coverDebtPaysTheSystemContract() public {
        vm.deal(address(rulebook), 1 ether);
        sys.setDebt(address(rulebook), 0.25 ether);
        rulebook.coverDebt();
        assertEq(address(sys).balance, 0.25 ether);
    }
}
