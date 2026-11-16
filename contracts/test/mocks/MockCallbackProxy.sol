// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title Test double for a Reactive callback proxy on a destination chain.
/// @notice Delivers a payload the way the network does: the first argument (the 32-byte word right after the
///         selector) is overwritten with the address of the reactive contract that requested the callback.
contract MockCallbackProxy {
    mapping(address => uint256) public debt;

    receive() external payable {}

    /// @notice Delivers `payload` to `target` as if `reactiveSender` had requested it. Bubbles up reverts.
    function deliver(address target, address reactiveSender, bytes memory payload) external {
        require(payload.length >= 36, "payload too short");
        assembly {
            mstore(add(payload, 36), reactiveSender)
        }
        (bool ok, bytes memory ret) = target.call(payload);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    function setDebt(address account, uint256 amount) external {
        debt[account] = amount;
    }
}
