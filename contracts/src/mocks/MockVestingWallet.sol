// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";

/// @title Testnet vesting contract: OpenZeppelin's real `VestingWallet` code, deployed with a short schedule.
/// @notice Adds nothing, so Rule 2 runs through exactly the code path a real vesting wallet would (C-3).
contract MockVestingWallet is VestingWallet {
    constructor(address beneficiary, uint64 startTimestamp, uint64 durationSeconds)
        VestingWallet(beneficiary, startTimestamp, durationSeconds)
    {}
}
