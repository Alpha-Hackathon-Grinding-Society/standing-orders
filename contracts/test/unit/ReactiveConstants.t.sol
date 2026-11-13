// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AbstractReactive} from "@reactive/src/base/AbstractReactive.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";

/// @dev Minimal reactive contract that exposes the library's internal constants. Its only job is to prove that
///      reactive-lib-omni compiles with our toolchain and that our constants match the library's.
contract ReactiveHarness is AbstractReactive {
    function react(LogRecord calldata) external onlySystem {}

    function system() external pure returns (address) {
        return address(SYSTEM);
    }

    function reactiveIgnore() external pure returns (uint256) {
        return REACTIVE_IGNORE;
    }
}

/// @notice Phase 0 placeholder suite: checks the protocol constants recorded in docs/NOTES.md.
contract ReactiveConstantsTest is Test {
    ReactiveHarness internal harness;

    function setUp() public {
        harness = new ReactiveHarness();
    }

    function test_cronTopicsMatchEventSignatures() public pure {
        assertEq(ReactiveConstants.CRON1, uint256(keccak256("Cron1(uint256)")));
        assertEq(ReactiveConstants.CRON10, uint256(keccak256("Cron10(uint256)")));
        assertEq(ReactiveConstants.CRON100, uint256(keccak256("Cron100(uint256)")));
        assertEq(ReactiveConstants.CRON1000, uint256(keccak256("Cron1000(uint256)")));
        assertEq(ReactiveConstants.CRON10000, uint256(keccak256("Cron10000(uint256)")));
    }

    function test_systemAddressMatchesLibrary() public view {
        assertEq(harness.system(), ReactiveConstants.SYSTEM);
        assertEq(address(harness._SERVICE_PROVIDER()), ReactiveConstants.SYSTEM);
    }

    function test_reactiveIgnoreIsLibraryWildcard() public view {
        assertEq(harness.reactiveIgnore(), 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad);
    }

    function test_reactRejectsCallersOtherThanSystem() public {
        AbstractReactive.LogRecord memory log;
        vm.expectRevert();
        harness.react(log);

        vm.prank(ReactiveConstants.SYSTEM);
        harness.react(log);
    }
}
