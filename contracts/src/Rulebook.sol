// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "@reactive/src/base/AbstractReactive.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";
import {ReactiveConstants} from "./libraries/ReactiveConstants.sol";

/// @dev Destination tx gas limit for Rulebook callbacks: executor work (~100k) + proxy overhead (~160k) + margin.
///      Fees are charged on gas used (docs/NOTES.md sections 5 and 11).
uint64 constant RULEBOOK_CALLBACK_GAS = 400_000;

/// @title One user's money rules, running on Reactive Network.
/// @notice Deployed from the user's own wallet (F-1), so that wallet is the owner and pays the REACT. Every decision
///         lives here; the executor on Base only carries it out.
///         Phase 2 implements Rule 1 (pay yourself first): when USDC from a listed income sender reaches the user's
///         wallet, `splitBps` of it is moved to the vault, never more than `periodCap` per period.
/// @dev Exact Reactive APIs are recorded in docs/NOTES.md. The executor accepts our callbacks because the network
///      injects this contract's address as their first argument and the user registered it (Design impact A).
contract Rulebook is AbstractReactive {
    uint256 internal constant TRANSFER_TOPIC = uint256(keccak256("Transfer(address,address,uint256)"));
    uint256 internal constant BPS = 10_000;

    /// @notice Smallest and largest split share: 1% and 50% (S-3).
    uint16 public constant MIN_SPLIT_BPS = 100;
    uint16 public constant MAX_SPLIT_BPS = 5000;
    uint64 public constant CALLBACK_GAS = RULEBOOK_CALLBACK_GAS;

    struct Config {
        /// @dev Chain of the income token, the executor and the vault (Base or Base Sepolia).
        uint256 chainId;
        /// @dev Income token (USDC) on that chain.
        address token;
        address executor;
        /// @dev The user's vault, from `VaultFactory.predictVault(user)`.
        address vault;
        uint16 splitBps;
        uint256 periodCap;
        uint256 periodLength;
        address[] incomeSenders;
        /// @dev One of `ReactiveConstants.CRON*`, or 0 for no cron (the cap period then rolls over on the next income).
        uint256 cronTopic;
    }

    address public immutable owner;
    uint256 public immutable chainId;
    address public immutable token;
    address public immutable executor;
    address public immutable vault;
    uint256 public immutable cronTopic;

    uint16 public splitBps;
    uint256 public periodCap;
    uint256 public periodLength;
    uint256 public periodStart;
    uint256 public splitThisPeriod;
    /// @notice Last callback nonce used; the executor rejects any nonce it has seen.
    uint256 public nonce;

    mapping(address => bool) public isIncomeSender;
    address[] internal _incomeSenders;

    event SplitRequested(
        uint256 indexed originTxHash, address indexed sender, uint256 income, uint256 amount, uint256 nonce
    );
    event IncomeIgnored(uint256 indexed originTxHash, address indexed sender, uint256 income);
    event CapReached(uint256 indexed originTxHash, uint256 income, uint256 periodStart);
    event PeriodReset(uint256 periodStart);
    event RulesEdited(uint16 splitBps, uint256 periodCap, address[] incomeSenders);

    error NotOwner();
    error ZeroAddress();
    error InvalidSplitBps(uint16 splitBps);
    error InvalidPeriod();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(Config memory config) payable {
        if (config.token == address(0) || config.executor == address(0) || config.vault == address(0)) {
            revert ZeroAddress();
        }
        if (config.periodLength == 0) revert InvalidPeriod();

        owner = msg.sender;
        chainId = config.chainId;
        token = config.token;
        executor = config.executor;
        vault = config.vault;
        cronTopic = config.cronTopic;
        periodLength = config.periodLength;
        periodStart = block.timestamp;
        _setRules(config.splitBps, config.periodCap, config.incomeSenders);

        // Rule 1 (S-1): USDC Transfer with `to` = the user. Senders are filtered in `react`, since a subscription
        // matches one value per topic.
        SYSTEM.subscribe(
            config.chainId, config.token, TRANSFER_TOPIC, REACTIVE_IGNORE, _topic(msg.sender), REACTIVE_IGNORE
        );
        if (config.cronTopic != 0) {
            SYSTEM.subscribe(
                block.chainid,
                ReactiveConstants.LEGACY_SYSTEM,
                config.cronTopic,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
        }
    }

    // ------------------------------------------------------------------ reactive entry point

    /// @inheritdoc IReactive
    function react(LogRecord calldata log) external onlySystem {
        if (_isCronTick(log)) {
            _rollPeriodIfDue();
            return;
        }
        if (_isIncome(log)) {
            _handleIncome(log);
        }
    }

    // ------------------------------------------------------------------ owner controls

    /// @notice Changes Rule 1: the split share, the per-period cap and the list of income senders.
    function editRules(uint16 newSplitBps, uint256 newPeriodCap, address[] calldata newIncomeSenders)
        external
        onlyOwner
    {
        _setRules(newSplitBps, newPeriodCap, newIncomeSenders);
    }

    /// @notice Pays any debt owed to the system contract from this contract's balance. Anyone may call it.
    function coverDebt() external {
        _coverDebt();
    }

    function incomeSenders() external view returns (address[] memory) {
        return _incomeSenders;
    }

    // ------------------------------------------------------------------ Rule 1 logic

    function _handleIncome(LogRecord calldata log) internal {
        address sender = address(uint160(log.topic1));
        uint256 income = abi.decode(log.data, (uint256));

        if (!isIncomeSender[sender]) {
            emit IncomeIgnored(log.txHash, sender, income);
            return;
        }

        _rollPeriodIfDue();
        uint256 amount = _splitAmount(income);
        if (amount == 0) {
            emit CapReached(log.txHash, income, periodStart);
            return;
        }

        splitThisPeriod += amount;
        nonce += 1;
        emit SplitRequested(log.txHash, sender, income, amount, nonce);
        _requestCallback(
            abi.encodeWithSignature(
                "split(address,address,address,uint256,uint256)", address(0), owner, token, amount, nonce
            )
        );
    }

    /// @notice The share of `income` to save now: `splitBps` of it, but no more than what is left of this period's cap.
    function _splitAmount(uint256 income) internal view returns (uint256) {
        uint256 share = income * splitBps / BPS;
        uint256 room = periodCap - splitThisPeriod;
        return share < room ? share : room;
    }

    /// @dev Starts a new cap period once `periodLength` has passed. Runs on cron and before every split, so a late
    ///      cron never holds back a split. Most cron ticks exit after this one comparison.
    function _rollPeriodIfDue() internal {
        if (block.timestamp < periodStart + periodLength) return;
        periodStart = block.timestamp;
        splitThisPeriod = 0;
        emit PeriodReset(block.timestamp);
    }

    function _setRules(uint16 newSplitBps, uint256 newPeriodCap, address[] memory newIncomeSenders) internal {
        if (newSplitBps < MIN_SPLIT_BPS || newSplitBps > MAX_SPLIT_BPS) revert InvalidSplitBps(newSplitBps);

        for (uint256 i; i < _incomeSenders.length; ++i) {
            isIncomeSender[_incomeSenders[i]] = false;
        }
        delete _incomeSenders;
        for (uint256 i; i < newIncomeSenders.length; ++i) {
            if (newIncomeSenders[i] == address(0)) revert ZeroAddress();
            isIncomeSender[newIncomeSenders[i]] = true;
            _incomeSenders.push(newIncomeSenders[i]);
        }

        splitBps = newSplitBps;
        periodCap = newPeriodCap;
        // A lower cap than what was already saved this period simply leaves no room until the period resets.
        if (splitThisPeriod > newPeriodCap) splitThisPeriod = newPeriodCap;
        emit RulesEdited(newSplitBps, newPeriodCap, newIncomeSenders);
    }

    // ------------------------------------------------------------------ helpers

    function _isCronTick(LogRecord calldata log) internal view returns (bool) {
        return cronTopic != 0 && log.chainId == block.chainid && log.contractAddress == ReactiveConstants.LEGACY_SYSTEM
            && log.topic0 == cronTopic;
    }

    function _isIncome(LogRecord calldata log) internal view returns (bool) {
        return log.chainId == chainId && log.contractAddress == token && log.topic0 == TRANSFER_TOPIC
            && log.topic2 == _topic(owner);
    }

    /// @dev Sends a callback to the executor. The first argument of `payload` is overwritten by the network with this
    ///      contract's address.
    function _requestCallback(bytes memory payload) internal {
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: chainId, recipient: executor, gasLimit: CALLBACK_GAS, payload: payload
            })
        );
    }

    function _topic(address account) internal pure returns (uint256) {
        return uint256(uint160(account));
    }
}
