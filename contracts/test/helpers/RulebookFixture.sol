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
    uint256 internal constant UNICHAIN_SEPOLIA = 1301;
    uint256 internal constant CLAIM_INTERVAL = 1 days;
    uint256 internal constant SILENCE = 90 days;
    uint256 internal constant GRACE = 14 days;
    uint256 internal constant CHECK_INTERVAL = 1 hours;

    MockSystem internal sys;
    Rulebook internal rulebook;

    address internal user = makeAddr("user");
    address internal usdc = makeAddr("usdc");
    address internal executor = makeAddr("executor");
    address internal vault = makeAddr("vault");
    address internal heartbeat = makeAddr("heartbeat");
    address internal vesting = makeAddr("vesting");
    address internal vestToken = makeAddr("vestToken");
    address internal employer = makeAddr("employer");
    address internal client = makeAddr("client");
    address internal stranger = makeAddr("stranger");

    uint256 internal txCounter;

    function _deploySystem() internal {
        vm.chainId(LASNA);
        vm.etch(ReactiveConstants.SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(payable(ReactiveConstants.SYSTEM));
    }

    /// @dev Rule 1 only (Rule 2 and the Guardian off).
    function _config(uint256 cronTopic) internal view returns (Rulebook.Config memory c) {
        address[] memory senders = new address[](2);
        senders[0] = employer;
        senders[1] = client;
        c = Rulebook.Config({
            chainId: BASE_SEPOLIA,
            token: usdc,
            executor: executor,
            vault: vault,
            heartbeat: heartbeat,
            splitBps: SPLIT_BPS,
            periodCap: PERIOD_CAP,
            periodLength: PERIOD_LENGTH,
            incomeSenders: senders,
            vesting: address(0),
            vestingToken: address(0),
            claimInterval: 0,
            watchedChains: new uint256[](0),
            silencePeriod: 0,
            gracePeriod: 0,
            guardianCheckInterval: 0,
            cronTopic: cronTopic
        });
    }

    /// @dev All three rules on, watching Base Sepolia and Unichain Sepolia, with mainnet-style timers.
    function _fullConfig() internal view returns (Rulebook.Config memory c) {
        c = _config(ReactiveConstants.CRON100);
        c.vesting = vesting;
        c.vestingToken = vestToken;
        c.claimInterval = CLAIM_INTERVAL;
        uint256[] memory chains = new uint256[](2);
        chains[0] = BASE_SEPOLIA;
        chains[1] = UNICHAIN_SEPOLIA;
        c.watchedChains = chains;
        c.silencePeriod = SILENCE;
        c.gracePeriod = GRACE;
        c.guardianCheckInterval = CHECK_INTERVAL;
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

    /// @dev A one-indexed-topic event from `emitter` on `chain` with `topic1` = user (Alive, Paused, Deposited...).
    function _userEvent(uint256 chain, address emitter, string memory sig) internal {
        IReactive.LogRecord memory log;
        log.chainId = chain;
        log.contractAddress = emitter;
        log.topic0 = uint256(keccak256(bytes(sig)));
        log.topic1 = uint256(uint160(user));
        log.opCode = 2;
        log.txHash = ++txCounter;
        _react(log);
    }

    /// @dev The user's own outgoing transfer of any token on `chain`.
    function _userTransfer(uint256 chain, address to) internal {
        _react(LogRecords.transfer(chain, makeAddr("anyToken"), user, to, 1e18, ++txCounter));
    }

    function _selector(uint256 i) internal view returns (bytes4) {
        return bytes4(sys.callbackAt(i).payload);
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
