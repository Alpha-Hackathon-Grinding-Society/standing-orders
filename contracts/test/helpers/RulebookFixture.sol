// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {LogRecords} from "./LogRecords.sol";

/// @title Shared setup for Rulebook tests: a mocked system contract and a Rulebook deployed by `user`.
abstract contract RulebookFixture is Test {
    uint256 internal constant LASNA = 5_318_007;
    uint256 internal constant BASE_SEPOLIA = 84_532;
    uint256 internal constant IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;
    uint16 internal constant SPLIT_BPS = 2000; // 20%
    uint256 internal constant PERIOD_CAP = 300e6;
    uint256 internal constant PERIOD_LENGTH = 30 days;

    MockSystem internal sys;
    Rulebook internal rulebook;

    address internal user = makeAddr("user");
    address internal usdc = makeAddr("usdc");
    address internal executor = makeAddr("executor");
    address internal vault = makeAddr("vault");
    address internal employer = makeAddr("employer");
    address internal client = makeAddr("client");
    address internal stranger = makeAddr("stranger");

    uint256 internal txCounter;

    function _deploySystem() internal {
        vm.chainId(LASNA);
        vm.etch(ReactiveConstants.SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(payable(ReactiveConstants.SYSTEM));
    }

    function _config(uint256 cronTopic) internal view returns (Rulebook.Config memory c) {
        address[] memory senders = new address[](2);
        senders[0] = employer;
        senders[1] = client;
        c = Rulebook.Config({
            chainId: BASE_SEPOLIA,
            token: usdc,
            executor: executor,
            vault: vault,
            splitBps: SPLIT_BPS,
            periodCap: PERIOD_CAP,
            periodLength: PERIOD_LENGTH,
            incomeSenders: senders,
            cronTopic: cronTopic
        });
    }

    function _deployRulebook(Rulebook.Config memory c) internal returns (Rulebook rb) {
        vm.prank(user);
        rb = new Rulebook(c);
    }

    function _pay(address from, uint256 value) internal {
        _react(LogRecords.transfer(BASE_SEPOLIA, usdc, from, user, value, ++txCounter));
    }

    function _cron() internal {
        _react(LogRecords.cron(LASNA, ReactiveConstants.CRON100, block.number));
    }

    function _react(IReactive.LogRecord memory log) internal {
        vm.prank(ReactiveConstants.SYSTEM);
        rulebook.react(log);
    }

    /// @dev Decodes the split callback the Rulebook asked for: (user, token, amount, nonce).
    function _lastSplit() internal view returns (address forUser, address token, uint256 amount, uint256 nonce) {
        bytes memory payload = sys.callbackAt(sys.callbackCount() - 1).payload;
        bytes memory args = new bytes(payload.length - 4);
        for (uint256 i; i < args.length; ++i) {
            args[i] = payload[i + 4];
        }
        (, forUser, token, amount, nonce) = abi.decode(args, (address, address, address, uint256, uint256));
    }
}
