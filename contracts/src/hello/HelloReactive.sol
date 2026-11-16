// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "@reactive/src/base/AbstractReactive.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";
import {ReactiveConstants} from "../libraries/ReactiveConstants.sol";

/// @dev Callback gas limit. It is the gas limit of the whole destination tx: the proxy keeps about 135k for
///         its own accounting and calldata takes about 25k, so the method gets roughly `HELLO_CALLBACK_GAS - 160k`.
///         Fees are charged on gas used, not on this limit (docs/NOTES.md section 5).
uint64 constant HELLO_CALLBACK_GAS = 500_000;

/// @title Phase 1 reactive contract on Lasna.
/// @notice Watches MockUSDC `Transfer` on the origin chain and pings `HelloReceiver` on the destination chain.
///         Also subscribes to one cron topic and counts ticks, so we can measure the real tick interval and cost.
/// @dev Exact Reactive APIs used are recorded in docs/NOTES.md (sections 3, 5 and 7).
contract HelloReactive is AbstractReactive {
    /// @notice topic0 of `Transfer(address,address,uint256)`.
    uint256 internal constant TRANSFER_TOPIC = uint256(keccak256("Transfer(address,address,uint256)"));

    error NotOwner();
    error CronAlreadyStopped();

    /// @notice Emitted on every cron tick, with the Reactive block's time and number.
    event Tick(uint256 timestamp, uint256 blockNumber, uint256 count);
    /// @notice Emitted when a transfer is seen and a callback requested. `originTxHash` links the three hops.
    event TransferSeen(uint256 indexed originTxHash, address indexed from, address indexed to, uint256 value);

    address public immutable owner;
    uint256 public immutable originChainId;
    address public immutable token;
    uint256 public immutable destinationChainId;
    address public immutable receiver;
    uint256 public immutable cronTopic;

    uint256 public tickCount;
    uint256 public lastTickTimestamp;
    uint256 public transferCount;
    bool public cronActive;

    /// @param originChainId_ Chain where MockUSDC lives (Base Sepolia).
    /// @param token_ MockUSDC address.
    /// @param destinationChainId_ Chain where HelloReceiver lives (Base Sepolia).
    /// @param receiver_ HelloReceiver address.
    /// @param cronTopic_ One of the `ReactiveConstants.CRON*` topics, or 0 for no cron subscription.
    constructor(
        uint256 originChainId_,
        address token_,
        uint256 destinationChainId_,
        address receiver_,
        uint256 cronTopic_
    ) payable {
        owner = msg.sender;
        originChainId = originChainId_;
        token = token_;
        destinationChainId = destinationChainId_;
        receiver = receiver_;
        cronTopic = cronTopic_;

        SYSTEM.subscribe(originChainId_, token_, TRANSFER_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        if (cronTopic_ != 0) {
            SYSTEM.subscribe(
                block.chainid,
                ReactiveConstants.LEGACY_SYSTEM,
                cronTopic_,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
            cronActive = true;
        }
    }

    /// @inheritdoc IReactive
    function react(LogRecord calldata log) external onlySystem {
        if (_isCronTick(log)) {
            tickCount += 1;
            lastTickTimestamp = block.timestamp;
            emit Tick(block.timestamp, block.number, tickCount);
            return;
        }

        if (_isTokenTransfer(log)) {
            address from = address(uint160(log.topic1));
            // Mints (from = 0) are only setup noise; ignore them without reverting.
            if (from == address(0)) return;

            address to = address(uint160(log.topic2));
            uint256 value = abi.decode(log.data, (uint256));
            transferCount += 1;
            emit TransferSeen(log.txHash, from, to, value);
            _requestPing(from, value);
        }
    }

    /// @notice Stops the cron subscription so the contract stops paying for ticks once enough are measured.
    function stopCron() external {
        if (msg.sender != owner) revert NotOwner();
        if (!cronActive) revert CronAlreadyStopped();
        cronActive = false;
        SYSTEM.unsubscribe(
            block.chainid, ReactiveConstants.LEGACY_SYSTEM, cronTopic, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
    }

    /// @notice Pays any debt owed to the system contract from this contract's balance. Anyone may call it.
    function coverDebt() external {
        _coverDebt();
    }

    function _isCronTick(LogRecord calldata log) internal view returns (bool) {
        return log.chainId == block.chainid && log.contractAddress == ReactiveConstants.LEGACY_SYSTEM
            && log.topic0 == cronTopic;
    }

    function _isTokenTransfer(LogRecord calldata log) internal view returns (bool) {
        return log.chainId == originChainId && log.contractAddress == token && log.topic0 == TRANSFER_TOPIC;
    }

    /// @dev The first argument is a placeholder: the network overwrites it with this contract's address.
    function _requestPing(address from, uint256 value) internal {
        bytes memory payload = abi.encodeWithSignature("ping(address,address,uint256)", address(0), from, value);
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: destinationChainId, recipient: receiver, gasLimit: HELLO_CALLBACK_GAS, payload: payload
            })
        );
    }
}
