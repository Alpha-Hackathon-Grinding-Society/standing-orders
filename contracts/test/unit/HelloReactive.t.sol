// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AbstractPayer} from "@reactive/src/base/AbstractPayer.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {HelloReactive} from "../../src/hello/HelloReactive.sol";
import {HelloReceiver} from "../../src/hello/HelloReceiver.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {LogRecords} from "../helpers/LogRecords.sol";

contract HelloReactiveTest is Test {
    uint256 internal constant LASNA = 5_318_007;
    uint256 internal constant BASE_SEPOLIA = 84_532;
    uint256 internal constant IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;

    MockSystem internal sys;
    HelloReactive internal hello;

    address internal token = makeAddr("mockUsdc");
    address internal receiver = makeAddr("helloReceiver");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        vm.chainId(LASNA);
        vm.etch(ReactiveConstants.SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(payable(ReactiveConstants.SYSTEM));
        hello = new HelloReactive{value: 1 ether}(BASE_SEPOLIA, token, BASE_SEPOLIA, receiver, ReactiveConstants.CRON10);
    }

    function _react(IReactive.LogRecord memory log) internal {
        vm.prank(ReactiveConstants.SYSTEM);
        hello.react(log);
    }

    function test_constructorSubscribesToTransferAndCron() public view {
        assertEq(sys.subscriptionCount(), 2);

        MockSystem.Subscription memory t = sys.subscriptionAt(0);
        assertEq(t.subscriber, address(hello));
        assertEq(t.chainId, BASE_SEPOLIA);
        assertEq(t.contractAddress, token);
        assertEq(t.topic0, LogRecords.TRANSFER_TOPIC);
        assertEq(t.topic1, IGNORE);
        assertEq(t.topic2, IGNORE);
        assertEq(t.topic3, IGNORE);

        MockSystem.Subscription memory c = sys.subscriptionAt(1);
        assertEq(c.chainId, LASNA);
        assertEq(c.contractAddress, ReactiveConstants.LEGACY_SYSTEM);
        assertEq(c.topic0, ReactiveConstants.CRON10);
        assertTrue(hello.cronActive());
    }

    function test_transferRequestsPingCallback() public {
        vm.expectEmit(address(hello));
        emit HelloReactive.TransferSeen(0xabc, alice, bob, 100e6);
        _react(LogRecords.transfer(BASE_SEPOLIA, token, alice, bob, 100e6, 0xabc));

        assertEq(sys.callbackCount(), 1);
        MockSystem.CallbackRequest memory cb = sys.callbackAt(0);
        assertEq(cb.requester, address(hello));
        assertEq(cb.chainId, BASE_SEPOLIA);
        assertEq(cb.recipient, receiver);
        assertGe(cb.gasLimit, ReactiveConstants.MIN_CALLBACK_GAS);
        assertEq(cb.payload, abi.encodeWithSelector(HelloReceiver.ping.selector, address(0), alice, 100e6));
        assertEq(hello.transferCount(), 1);
    }

    function test_mintIsIgnored() public {
        _react(LogRecords.transfer(BASE_SEPOLIA, token, address(0), alice, 1000e6, 0x1));
        assertEq(sys.callbackCount(), 0);
        assertEq(hello.transferCount(), 0);
    }

    function test_otherTokenOrChainIsIgnored() public {
        _react(LogRecords.transfer(BASE_SEPOLIA, makeAddr("otherToken"), alice, bob, 1, 0x1));
        _react(LogRecords.transfer(1, token, alice, bob, 1, 0x1));
        assertEq(sys.callbackCount(), 0);
    }

    function test_cronTickIncrementsCounter() public {
        vm.warp(1000);
        vm.expectEmit(address(hello));
        emit HelloReactive.Tick(1000, block.number, 1);
        _react(LogRecords.cron(LASNA, ReactiveConstants.CRON10, 42));

        vm.warp(1011);
        _react(LogRecords.cron(LASNA, ReactiveConstants.CRON10, 52));
        assertEq(hello.tickCount(), 2);
        assertEq(hello.lastTickTimestamp(), 1011);
        assertEq(sys.callbackCount(), 0);
    }

    function test_otherCronTopicIsIgnored() public {
        _react(LogRecords.cron(LASNA, ReactiveConstants.CRON1, 42));
        assertEq(hello.tickCount(), 0);
    }

    function test_reactRejectsCallersOtherThanSystem() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, alice, ReactiveConstants.SYSTEM));
        hello.react(LogRecords.cron(LASNA, ReactiveConstants.CRON10, 1));
    }

    function test_stopCronUnsubscribesExactly() public {
        hello.stopCron();
        assertFalse(hello.cronActive());
        assertEq(sys.unsubscriptionCount(), 1);
        MockSystem.Subscription memory u = sys.unsubscriptionAt(0);
        MockSystem.Subscription memory s = sys.subscriptionAt(1);
        assertEq(abi.encode(u), abi.encode(s));

        vm.expectRevert(HelloReactive.CronAlreadyStopped.selector);
        hello.stopCron();
    }

    function test_stopCronIsOwnerOnly() public {
        vm.prank(alice);
        vm.expectRevert(HelloReactive.NotOwner.selector);
        hello.stopCron();
    }

    function test_coverDebtPaysTheSystemContract() public {
        sys.setDebt(address(hello), 0.2 ether);
        hello.coverDebt();
        assertEq(address(sys).balance, 0.2 ether);
        assertEq(address(hello).balance, 0.8 ether);
    }
}
