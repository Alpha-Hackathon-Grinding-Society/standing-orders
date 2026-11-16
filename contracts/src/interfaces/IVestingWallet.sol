// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title The part of OpenZeppelin's `VestingWallet` that Rule 2 uses.
/// @dev Matches `openzeppelin-contracts/contracts/finance/VestingWallet.sol` v5.7: `release(token)` is public and pays
///      the wallet's `owner()` (the vesting beneficiary). No event is emitted as tokens vest, so Rule 2 runs on cron.
interface IVestingWallet {
    function owner() external view returns (address);
    function releasable(address token) external view returns (uint256);
    function release(address token) external;
}
