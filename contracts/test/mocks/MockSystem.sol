// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";

/// @title Test double for the Reactive system contract at 0x8888...8888.
/// @notice Tests `vm.etch` this code at `ReactiveConstants.SYSTEM`. It records subscriptions and callback requests
///         so tests can assert on exactly what a reactive contract asked the network to do.
contract MockSystem {
    struct Subscription {
        address subscriber;
        uint256 chainId;
        address contractAddress;
        uint256 topic0;
        uint256 topic1;
        uint256 topic2;
        uint256 topic3;
    }

    struct CallbackRequest {
        address requester;
        uint256 chainId;
        address recipient;
        uint64 gasLimit;
        bytes payload;
    }

    Subscription[] internal _subscriptions;
    Subscription[] internal _unsubscriptions;
    CallbackRequest[] internal _callbacks;
    mapping(address => uint256) public debt;

    receive() external payable {}

    function subscribe(uint256 chainId, address c, uint256 t0, uint256 t1, uint256 t2, uint256 t3) external {
        _subscriptions.push(Subscription(msg.sender, chainId, c, t0, t1, t2, t3));
    }

    function unsubscribe(uint256 chainId, address c, uint256 t0, uint256 t1, uint256 t2, uint256 t3) external {
        _unsubscriptions.push(Subscription(msg.sender, chainId, c, t0, t1, t2, t3));
    }

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory config) external {
        _callbacks.push(CallbackRequest(msg.sender, config.chainId, config.recipient, config.gasLimit, config.payload));
    }

    function setDebt(address account, uint256 amount) external {
        debt[account] = amount;
    }

    function subscriptionCount() external view returns (uint256) {
        return _subscriptions.length;
    }

    function subscriptionAt(uint256 i) external view returns (Subscription memory) {
        return _subscriptions[i];
    }

    function unsubscriptionCount() external view returns (uint256) {
        return _unsubscriptions.length;
    }

    function unsubscriptionAt(uint256 i) external view returns (Subscription memory) {
        return _unsubscriptions[i];
    }

    function callbackCount() external view returns (uint256) {
        return _callbacks.length;
    }

    function callbackAt(uint256 i) external view returns (CallbackRequest memory) {
        return _callbacks[i];
    }
}
