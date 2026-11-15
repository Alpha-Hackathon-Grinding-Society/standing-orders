// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {RulebookFixture} from "../helpers/RulebookFixture.sol";

contract Rule1FuzzTest is RulebookFixture {
    function setUp() public {
        _deploySystem();
        rulebook = _deployRulebook(_config(ReactiveConstants.CRON100));
    }

    /// @notice Within one period, the splits the Rulebook requests never add up to more than the cap, and each one is
    ///         exactly the bps share or the remaining room.
    function testFuzz_S3_neverExceedsPeriodCap(uint256[8] memory incomes, uint32[8] memory gaps) public {
        uint256 requestedThisPeriod;
        uint256 currentPeriodStart = rulebook.periodStart();

        for (uint256 i; i < incomes.length; ++i) {
            vm.warp(block.timestamp + bound(gaps[i], 0, 20 days));
            uint256 income = bound(incomes[i], 0, 10_000_000e6);

            uint256 before = sys.callbackCount();
            _pay(employer, income);

            if (rulebook.periodStart() != currentPeriodStart) {
                currentPeriodStart = rulebook.periodStart();
                requestedThisPeriod = 0;
            }
            if (sys.callbackCount() > before) {
                (,, uint256 amount,) = _lastSplit();
                uint256 roomBefore = PERIOD_CAP - requestedThisPeriod;
                uint256 share = income * SPLIT_BPS / 10_000;
                assertEq(amount, share < roomBefore ? share : roomBefore);
                requestedThisPeriod += amount;
            }
            assertLe(requestedThisPeriod, PERIOD_CAP);
            assertEq(rulebook.splitThisPeriod(), requestedThisPeriod);
        }
    }

    /// @notice Nonces strictly increase, so the executor never sees a repeat from an honest Rulebook.
    function testFuzz_nonceIncrementsOncePerSplit(uint8 payments) public {
        uint256 n = bound(payments, 1, 30);
        for (uint256 i; i < n; ++i) {
            _pay(employer, 10e6);
            (,,, uint256 nonce) = _lastSplit();
            assertEq(nonce, i + 1);
        }
    }
}
