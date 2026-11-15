// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractCallback} from "@reactive/src/base/AbstractCallback.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";

/// @title Phase 1 callback receiver on Base Sepolia.
/// @notice Proves the reactive loop: `HelloReactive` on Lasna sees a MockUSDC transfer and calls `ping` here
///         through the Base Sepolia callback proxy.
/// @dev Both library guards are used, as the docs require (docs/NOTES.md section 6):
///      `onlyServiceProvider` checks that msg.sender is the callback proxy, and `onlyCallbackSender` checks that the
///      first argument, which the network overwrites with the requesting reactive contract's address, is the
///      expected `HelloReactive`.
contract HelloReceiver is AbstractCallback {
    /// @param rvmId Sender injected by the network (expected: the HelloReactive contract).
    /// @param from Sender of the observed MockUSDC transfer on the origin chain.
    /// @param value Amount of the observed transfer.
    /// @param count Total pings received so far.
    event Pinged(address indexed rvmId, address indexed from, uint256 value, uint256 count);

    address public lastRvmId;
    address public lastFrom;
    uint256 public lastValue;
    uint256 public pingCount;

    /// @param callbackProxy The Reactive callback proxy on this chain.
    /// @param helloReactive The only reactive contract allowed to ping.
    constructor(IPayable callbackProxy, address helloReactive) payable AbstractCallback(callbackProxy, helloReactive) {}

    /// @notice Callback entry point. Only the proxy may call it, and only on behalf of `HelloReactive`.
    function ping(address rvmId, address from, uint256 value) external onlyServiceProvider onlyCallbackSender(rvmId) {
        lastRvmId = rvmId;
        lastFrom = from;
        lastValue = value;
        pingCount += 1;
        emit Pinged(rvmId, from, value, pingCount);
    }

    /// @notice Pays any callback debt owed to the proxy from this contract's ETH balance. Anyone may call it.
    function coverDebt() external {
        _coverDebt();
    }
}
