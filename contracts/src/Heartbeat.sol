// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title "I'm alive" button on Base.
/// @notice A plain ETH send emits no event, so it can't count as activity. Calling `alive()` does: the user's
///         Rulebook watches `Alive(user)` and resets the Guardian's silence clock.
contract Heartbeat {
    event Alive(address indexed user);

    function alive() external {
        emit Alive(msg.sender);
    }
}
