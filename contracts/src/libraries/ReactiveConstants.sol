// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title Reactive Network protocol constants used by Steward.
/// @notice Values come from the Reactive docs (reactive-contracts.mdx, "Subscribing To CRON Events") and are
///         checked against keccak256 of the event signatures in test/unit/ReactiveConstants.t.sol.
///         See docs/NOTES.md, section "Cron".
library ReactiveConstants {
    /// @notice Legacy system contract that emits the CronN events. Cron subscriptions name this address,
    ///         while every other call goes to the Omni system contract (`SYSTEM` in AbstractReactive).
    address internal constant LEGACY_SYSTEM = 0x0000000000000000000000000000000000fffFfF;

    /// @notice Omni system contract on Reactive mainnet and Lasna (same address as `AbstractReactive.SYSTEM`).
    address internal constant SYSTEM = 0x8888888888888888888888888888888888888888;

    /// @notice topic0 of `Cron1(uint256)`, fired every block.
    uint256 internal constant CRON1 = 0xf02d6ea5c22a71cffe930a4523fcb4f129be6c804db50e4202fb4e0b07ccb514;
    /// @notice topic0 of `Cron10(uint256)`, fired every 10 blocks.
    uint256 internal constant CRON10 = 0x04463f7c1651e6b9774d7f85c85bb94654e3c46ca79b0c16fb16d4183307b687;
    /// @notice topic0 of `Cron100(uint256)`, fired every 100 blocks.
    uint256 internal constant CRON100 = 0xb49937fb8970e19fd46d48f7e3fb00d659deac0347f79cd7cb542f0fc1503c70;
    /// @notice topic0 of `Cron1000(uint256)`, fired every 1,000 blocks.
    uint256 internal constant CRON1000 = 0xe20b31294d84c3661ddc8f423abb9c70310d0cf172aa2714ead78029b325e3f4;
    /// @notice topic0 of `Cron10000(uint256)`, fired every 10,000 blocks.
    uint256 internal constant CRON10000 = 0xd214e1d84db704ed42d37f538ea9bf71e44ba28bc1cc088b2f5deca654677a56;

    /// @notice Minimum callback gas limit; smaller requests are ignored by the network (economy.mdx, "Gas Limits").
    uint64 internal constant MIN_CALLBACK_GAS = 100_000;
}
