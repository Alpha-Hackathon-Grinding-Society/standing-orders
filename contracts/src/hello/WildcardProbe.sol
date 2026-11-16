// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "@reactive/src/base/AbstractReactive.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";

/// @title Phase 1 probe: does a contract-wildcard subscription filtered on the user's address work live?
/// @notice Subscribes to `Transfer(from = user)` and `Approval(owner = user)` on **any** token contract of one chain,
///         the exact shape the Guardian's activity subscriptions use (CLAUDE.md "Subscriptions per Rulebook").
///         Each matching log is recorded with an event; nothing else happens.
contract WildcardProbe is AbstractReactive {
    uint256 internal constant TRANSFER_TOPIC = uint256(keccak256("Transfer(address,address,uint256)"));
    uint256 internal constant APPROVAL_TOPIC = uint256(keccak256("Approval(address,address,uint256)"));

    /// @param originTxHash Origin transaction that emitted the matched log.
    /// @param token Token contract that emitted it (any contract, by design).
    /// @param topic0 Event signature matched.
    event ActivitySeen(uint256 indexed originTxHash, address indexed token, uint256 indexed topic0);

    address public immutable user;
    uint256 public immutable chainId;
    uint256 public seenCount;

    constructor(uint256 chainId_, address user_) payable {
        user = user_;
        chainId = chainId_;
        uint256 userTopic = uint256(uint160(user_));
        SYSTEM.subscribe(chainId_, address(0), TRANSFER_TOPIC, userTopic, REACTIVE_IGNORE, REACTIVE_IGNORE);
        SYSTEM.subscribe(chainId_, address(0), APPROVAL_TOPIC, userTopic, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    /// @inheritdoc IReactive
    function react(LogRecord calldata log) external onlySystem {
        seenCount += 1;
        emit ActivitySeen(log.txHash, log.contractAddress, log.topic0);
    }

    /// @notice Pays any debt owed to the system contract from this contract's balance. Anyone may call it.
    function coverDebt() external {
        _coverDebt();
    }
}
