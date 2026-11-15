// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";

/// @title Builders for synthetic `LogRecord`s, so tests can call `react()` the way the system contract does.
library LogRecords {
    uint256 internal constant TRANSFER_TOPIC = uint256(keccak256("Transfer(address,address,uint256)"));

    function transfer(uint256 chainId, address token, address from, address to, uint256 value, uint256 txHash)
        internal
        pure
        returns (IReactive.LogRecord memory log)
    {
        log.chainId = chainId;
        log.contractAddress = token;
        log.topic0 = TRANSFER_TOPIC;
        log.topic1 = uint256(uint160(from));
        log.topic2 = uint256(uint160(to));
        log.data = abi.encode(value);
        log.opCode = 3;
        log.txHash = txHash;
    }

    function cron(uint256 reactiveChainId, uint256 cronTopic, uint256 blockNumber)
        internal
        pure
        returns (IReactive.LogRecord memory log)
    {
        log.chainId = reactiveChainId;
        log.contractAddress = ReactiveConstants.LEGACY_SYSTEM;
        log.topic0 = cronTopic;
        log.data = abi.encode(blockNumber);
        log.blockNumber = blockNumber;
        log.opCode = 1;
    }
}
