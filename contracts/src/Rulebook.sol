// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "@reactive/src/base/AbstractReactive.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";
import {ReactiveConstants} from "./libraries/ReactiveConstants.sol";

/// @dev Destination tx gas limit for Rulebook callbacks: executor work (a claim with a cold-wallet forward is
///      ~150k) + proxy overhead (~160k) + margin. Fees are charged on gas used (docs/NOTES.md sections 5 and 11).
uint64 constant RULEBOOK_CALLBACK_GAS = 500_000;

/// @title One user's money rules, running on Reactive Network.
/// @notice Deployed from the user's own wallet (F-1), so that wallet is the owner and pays the REACT. Every decision
///         lives here; the executor on Base only carries it out.
///         - Rule 1, pay yourself first: when USDC from a listed sender reaches the user, `splitBps` of it moves to
///           the vault, never more than `periodCap` per period.
///         - Rule 2, claim and secure: every `claimInterval`, ask the executor to claim vested tokens into the vault.
///         - Rule 3, Guardian: if the user shows no signed activity on any watched chain for `silencePeriod`, warn;
///           if the silence lasts through `gracePeriod`, release the vault to the beneficiary and stop.
/// @dev The executor accepts our callbacks because the network injects this contract's address as their first
///      argument and the user registered it (docs/NOTES.md, Design impact A). Log records carry no timestamp, so
///      activity is timed with this chain's `block.timestamp` when the log is processed (NOTES section 4).
contract Rulebook is AbstractReactive {
    uint256 internal constant TRANSFER_TOPIC = uint256(keccak256("Transfer(address,address,uint256)"));
    uint256 internal constant APPROVAL_TOPIC = uint256(keccak256("Approval(address,address,uint256)"));
    uint256 internal constant ALIVE_TOPIC = uint256(keccak256("Alive(address)"));
    uint256 internal constant DEPOSITED_TOPIC = uint256(keccak256("Deposited(address,address,uint256)"));
    uint256 internal constant WITHDRAWN_TOPIC = uint256(keccak256("Withdrawn(address,address,uint256)"));
    uint256 internal constant PAUSED_TOPIC = uint256(keccak256("Paused(address)"));
    uint256 internal constant UNPAUSED_TOPIC = uint256(keccak256("Unpaused(address)"));
    uint256 internal constant BPS = 10_000;

    /// @notice Smallest and largest split share: 1% and 50% (S-3).
    uint16 public constant MIN_SPLIT_BPS = 100;
    uint16 public constant MAX_SPLIT_BPS = 5000;
    uint64 public constant CALLBACK_GAS = RULEBOOK_CALLBACK_GAS;

    enum GuardianState {
        Active,
        Warning,
        Released
    }

    struct Config {
        /// @dev Chain of the income token, executor, vault and heartbeat (Base or Base Sepolia).
        uint256 chainId;
        address token;
        address executor;
        /// @dev The user's vault, from `VaultFactory.predictVault(user)`.
        address vault;
        address heartbeat;
        // Rule 1
        uint16 splitBps;
        uint256 periodCap;
        uint256 periodLength;
        address[] incomeSenders;
        // Rule 2: `vesting` = address(0) turns it off
        address vesting;
        address vestingToken;
        uint256 claimInterval;
        // Rule 3: `silencePeriod` = 0 turns it off
        uint256[] watchedChains;
        uint256 silencePeriod;
        uint256 gracePeriod;
        uint256 guardianCheckInterval;
        /// @dev One of `ReactiveConstants.CRON*`, or 0 for none (then only `checkNow` and incoming events drive it).
        uint256 cronTopic;
    }

    struct Subscription {
        uint256 chainId;
        address contractAddress;
        uint256 topic0;
        uint256 topic1;
        uint256 topic2;
    }

    // ------------------------------------------------------------------ settings

    address public immutable owner;
    uint256 public immutable chainId;
    address public immutable token;
    address public immutable executor;
    address public immutable vault;
    address public immutable heartbeat;
    address public immutable vesting;
    address public immutable vestingToken;
    uint256 public immutable cronTopic;

    uint16 public splitBps;
    uint256 public periodCap;
    uint256 public periodLength;
    mapping(address => bool) public isIncomeSender;
    address[] internal _incomeSenders;

    uint256 public claimInterval;

    uint256 public silencePeriod;
    uint256 public gracePeriod;
    uint256 public guardianCheckInterval;
    mapping(uint256 chainId => bool) public isWatched;
    uint256[] internal _watchedChains;

    // ------------------------------------------------------------------ state

    uint256 public periodStart;
    uint256 public splitThisPeriod;
    uint256 public lastClaimCheck;
    uint256 public lastGuardianCheck;
    /// @notice Earliest time any cron work is due; ticks before it return after one comparison.
    uint256 public nextCronWork;

    GuardianState public state;
    uint256 public warningSince;
    uint256 public lastActiveAny;
    mapping(uint256 chainId => uint256) public lastActive;

    /// @notice Mirrors the executor's pause switch for this user, from its `Paused` / `Unpaused` events (U-3).
    bool public paused;
    /// @notice Last callback nonce used; the executor rejects any nonce it has seen.
    uint256 public nonce;

    Subscription[] internal _subscriptions;

    // ------------------------------------------------------------------ events

    event SplitRequested(
        uint256 indexed originTxHash, address indexed sender, uint256 income, uint256 amount, uint256 nonce
    );
    event IncomeIgnored(uint256 indexed originTxHash, address indexed sender, uint256 income);
    event CapReached(uint256 indexed originTxHash, uint256 income, uint256 periodStart);
    event SkippedWhilePaused(uint256 indexed originTxHash);
    event PeriodReset(uint256 periodStart);
    event RulesEdited(uint16 splitBps, uint256 periodCap, address[] incomeSenders);
    event ClaimRequested(address indexed vesting, address indexed token, uint256 nonce);
    event ActivityRecorded(uint256 indexed chainId, uint256 indexed originTxHash, uint256 timestamp);
    event PauseSeen(bool paused);
    event GuardianWarning(uint256 warningSince, uint256 lastActiveAny);
    event GuardianCleared(uint256 indexed chainId, uint256 indexed originTxHash);
    event GuardianReleased(uint256 nonce);

    error NotOwner();
    error ZeroAddress();
    error InvalidSplitBps(uint16 splitBps);
    error InvalidPeriod();
    error InvalidVesting();
    error InvalidGuardian();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(Config memory config) payable {
        _validate(config);

        owner = msg.sender;
        chainId = config.chainId;
        token = config.token;
        executor = config.executor;
        vault = config.vault;
        heartbeat = config.heartbeat;
        vesting = config.vesting;
        vestingToken = config.vestingToken;
        cronTopic = config.cronTopic;

        periodLength = config.periodLength;
        _setRules(config.splitBps, config.periodCap, config.incomeSenders);
        claimInterval = config.claimInterval;
        silencePeriod = config.silencePeriod;
        gracePeriod = config.gracePeriod;
        guardianCheckInterval = config.guardianCheckInterval;
        for (uint256 i; i < config.watchedChains.length; ++i) {
            if (!isWatched[config.watchedChains[i]]) {
                isWatched[config.watchedChains[i]] = true;
                _watchedChains.push(config.watchedChains[i]);
            }
        }

        // Deploying the Rulebook is the user's own signed action: every clock starts now.
        periodStart = block.timestamp;
        lastClaimCheck = block.timestamp;
        lastGuardianCheck = block.timestamp;
        lastActiveAny = block.timestamp;
        _scheduleCronWork();

        _subscribeAll();
    }

    // ------------------------------------------------------------------ reactive entry point

    /// @inheritdoc IReactive
    function react(LogRecord calldata log) external onlySystem {
        if (state == GuardianState.Released) return;

        if (_isCronTick(log)) {
            _onCron();
            return;
        }

        if (log.chainId == chainId && log.topic1 == _topic(owner)) {
            if (log.contractAddress == executor && (log.topic0 == PAUSED_TOPIC || log.topic0 == UNPAUSED_TOPIC)) {
                paused = log.topic0 == PAUSED_TOPIC;
                emit PauseSeen(paused);
                _recordActivity(log);
                return;
            }
            if (log.contractAddress == heartbeat && log.topic0 == ALIVE_TOPIC) {
                _recordActivity(log);
                return;
            }
            if (log.contractAddress == vault && (log.topic0 == DEPOSITED_TOPIC || log.topic0 == WITHDRAWN_TOPIC)) {
                _recordActivity(log);
                return;
            }
        }

        if (_isIncome(log)) _handleIncome(log);
        if (_isOutgoingActivity(log)) _recordActivity(log);
    }

    // ------------------------------------------------------------------ public and owner functions

    /// @notice Advances the Guardian by timestamp, for when cron is late or unavailable (G-5). Anyone may call it;
    ///         it only ever does what the next due cron tick would do for the Guardian.
    function checkNow() external {
        if (state == GuardianState.Released || silencePeriod == 0) return;
        lastGuardianCheck = block.timestamp;
        _guardianStep();
        _scheduleCronWork();
    }

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

    function watchedChains() external view returns (uint256[] memory) {
        return _watchedChains;
    }

    function subscriptions() external view returns (Subscription[] memory) {
        return _subscriptions;
    }

    // ------------------------------------------------------------------ Rule 1: split

    function _handleIncome(LogRecord calldata log) internal {
        address sender = address(uint160(log.topic1));
        uint256 income = abi.decode(log.data, (uint256));

        if (!isIncomeSender[sender]) {
            emit IncomeIgnored(log.txHash, sender, income);
            return;
        }
        if (paused) {
            emit SkippedWhilePaused(log.txHash);
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
    ///      cron never holds back a split.
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

    // ------------------------------------------------------------------ cron: Rule 2, Guardian, cap period

    /// @dev Most ticks return here after one comparison (G-2: "most cron ticks exit after one timestamp check").
    function _onCron() internal {
        if (block.timestamp < nextCronWork) return;
        _rollPeriodIfDue();
        _claimIfDue();
        _guardianCheckIfDue();
        _scheduleCronWork();
    }

    function _claimIfDue() internal {
        if (vesting == address(0) || block.timestamp < lastClaimCheck + claimInterval) return;
        lastClaimCheck = block.timestamp;
        if (paused) {
            emit SkippedWhilePaused(0);
            return;
        }
        nonce += 1;
        emit ClaimRequested(vesting, vestingToken, nonce);
        _requestCallback(
            abi.encodeWithSignature(
                "claim(address,address,address,address,uint256)", address(0), owner, vesting, vestingToken, nonce
            )
        );
    }

    function _guardianCheckIfDue() internal {
        if (silencePeriod == 0 || block.timestamp < lastGuardianCheck + guardianCheckInterval) return;
        lastGuardianCheck = block.timestamp;
        _guardianStep();
    }

    function _scheduleCronWork() internal {
        uint256 next = periodStart + periodLength;
        if (vesting != address(0)) next = _min(next, lastClaimCheck + claimInterval);
        if (silencePeriod != 0) next = _min(next, lastGuardianCheck + guardianCheckInterval);
        nextCronWork = next;
    }

    // ------------------------------------------------------------------ Rule 3: Guardian

    /// @dev Active -> Warning after `silencePeriod` of silence; Warning -> Released after a further `gracePeriod`.
    ///      The two transitions always happen on different calls, so a release can never be a single step. While the
    ///      user is paused, a due release waits: the executor would reject it, and pausing is a deliberate choice.
    function _guardianStep() internal {
        if (state == GuardianState.Active) {
            if (block.timestamp - lastActiveAny > silencePeriod) {
                state = GuardianState.Warning;
                warningSince = block.timestamp;
                emit GuardianWarning(block.timestamp, lastActiveAny);
            }
        } else if (state == GuardianState.Warning) {
            if (block.timestamp - warningSince > gracePeriod && !paused) {
                _release();
            }
        }
    }

    function _release() internal {
        state = GuardianState.Released;
        nonce += 1;
        emit GuardianReleased(nonce);

        address[] memory tokens = new address[](vestingToken == address(0) ? 1 : 2);
        tokens[0] = token;
        if (vestingToken != address(0)) tokens[1] = vestingToken;
        _requestCallback(
            abi.encodeWithSignature("release(address,address,address[],uint256)", address(0), owner, tokens, nonce)
        );

        // Final: stop listening, so the Rulebook stops spending REACT.
        for (uint256 i; i < _subscriptions.length; ++i) {
            Subscription memory s = _subscriptions[i];
            SYSTEM.unsubscribe(s.chainId, s.contractAddress, s.topic0, s.topic1, s.topic2, REACTIVE_IGNORE);
        }
    }

    /// @dev G-1: only actions the user signs count. Everything that calls this was matched on `topic1 == user`.
    function _recordActivity(LogRecord calldata log) internal {
        lastActive[log.chainId] = block.timestamp;
        lastActiveAny = block.timestamp;
        emit ActivityRecorded(log.chainId, log.txHash, block.timestamp);
        if (state == GuardianState.Warning) {
            state = GuardianState.Active;
            warningSince = 0;
            emit GuardianCleared(log.chainId, log.txHash);
        }
    }

    /// @dev An outgoing transfer or an approval by the user on a watched chain. Transfers into the user's own vault
    ///      are the executor's automated moves (or owner deposits, which count via `Deposited`), so they are ignored
    ///      (safety invariant 6). Vesting releases come *from* the vesting contract, so they never match.
    function _isOutgoingActivity(LogRecord calldata log) internal view returns (bool) {
        if (!isWatched[log.chainId] || log.topic1 != _topic(owner)) return false;
        if (log.topic0 == APPROVAL_TOPIC) return true;
        return log.topic0 == TRANSFER_TOPIC && !(log.chainId == chainId && log.topic2 == _topic(vault));
    }

    // ------------------------------------------------------------------ subscriptions

    function _subscribeAll() internal {
        uint256 user = _topic(owner);
        // Rule 1 (S-1): USDC Transfer with `to` = user. Senders are filtered in `react`.
        _subscribe(chainId, token, TRANSFER_TOPIC, REACTIVE_IGNORE, user);
        if (silencePeriod != 0) {
            // Guardian activity (G-1, G-4): the user's own transfers and approvals on any token of each watched chain.
            for (uint256 i; i < _watchedChains.length; ++i) {
                _subscribe(_watchedChains[i], address(0), TRANSFER_TOPIC, user, REACTIVE_IGNORE);
                _subscribe(_watchedChains[i], address(0), APPROVAL_TOPIC, user, REACTIVE_IGNORE);
            }
            _subscribe(chainId, heartbeat, ALIVE_TOPIC, user, REACTIVE_IGNORE);
            _subscribe(chainId, vault, DEPOSITED_TOPIC, user, REACTIVE_IGNORE);
            _subscribe(chainId, vault, WITHDRAWN_TOPIC, user, REACTIVE_IGNORE);
        }
        // Pause switch (U-3): also activity.
        _subscribe(chainId, executor, PAUSED_TOPIC, user, REACTIVE_IGNORE);
        _subscribe(chainId, executor, UNPAUSED_TOPIC, user, REACTIVE_IGNORE);
        if (cronTopic != 0) {
            _subscribe(block.chainid, ReactiveConstants.LEGACY_SYSTEM, cronTopic, REACTIVE_IGNORE, REACTIVE_IGNORE);
        }
    }

    function _subscribe(uint256 chain, address contractAddress, uint256 topic0, uint256 topic1, uint256 topic2)
        internal
    {
        SYSTEM.subscribe(chain, contractAddress, topic0, topic1, topic2, REACTIVE_IGNORE);
        _subscriptions.push(Subscription(chain, contractAddress, topic0, topic1, topic2));
    }

    // ------------------------------------------------------------------ helpers

    function _validate(Config memory c) internal pure {
        if (c.token == address(0) || c.executor == address(0) || c.vault == address(0) || c.heartbeat == address(0)) {
            revert ZeroAddress();
        }
        if (c.periodLength == 0) revert InvalidPeriod();
        if (c.vesting != address(0) && (c.vestingToken == address(0) || c.claimInterval == 0)) revert InvalidVesting();
        if (c.silencePeriod != 0 && (c.watchedChains.length == 0 || c.guardianCheckInterval == 0)) {
            revert InvalidGuardian();
        }
    }

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

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
