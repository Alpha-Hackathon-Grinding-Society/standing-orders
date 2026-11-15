// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title One user's savings vault on Base.
/// @notice The owner can deposit and withdraw at any time, including while their rules are paused or the Guardian is
///         in Warning. Funds can leave only three ways: `withdraw` to the owner, `forwardToColdWallet` to the owner's
///         chosen cold wallet, or `release` to the beneficiary after a full Guardian cycle. The last two can only be
///         called by the executor. Changing the beneficiary or the cold wallet takes effect only after 24 hours.
/// @dev Deployed by `VaultFactory` with CREATE2 (salt = owner), so its address is known before setup is signed.
contract SavingsVault {
    using SafeERC20 for IERC20;

    /// @notice Delay before a proposed beneficiary or cold wallet takes effect (V-3, safety invariant 7).
    uint256 public constant CHANGE_DELAY = 24 hours;

    address public immutable owner;
    address public immutable executor;
    address public immutable factory;

    address public beneficiary;
    address public pendingBeneficiary;
    uint256 public pendingBeneficiaryReadyAt;

    /// @notice Where Rule 2 claims are forwarded, or address(0) to keep them in the vault (V-4).
    address public coldWallet;
    address public pendingColdWallet;
    /// @dev Non-zero while a cold-wallet change is pending (the pending value itself may be address(0) = "clear").
    uint256 public pendingColdWalletReadyAt;

    /// @notice Tokens the vault knows it may hold; `release` sends all of them. Grows on deposit and release.
    address[] internal _tokens;
    mapping(address => bool) public isTracked;

    /// @notice Owner deposit. Counts as Guardian activity.
    event Deposited(address indexed owner, address indexed token, uint256 amount);
    /// @notice Owner withdrawal. Counts as Guardian activity.
    event Withdrawn(address indexed owner, address indexed token, uint256 amount);
    event BeneficiaryProposed(address indexed beneficiary, uint256 readyAt);
    event BeneficiaryChanged(address indexed beneficiary);
    event ColdWalletProposed(address indexed coldWallet, uint256 readyAt);
    event ColdWalletChanged(address indexed coldWallet);
    event ForwardedToColdWallet(address indexed token, address indexed coldWallet, uint256 amount);
    event Released(address indexed beneficiary, address indexed token, uint256 amount);

    error NotOwner();
    error NotExecutor();
    error NotFactory();
    error ZeroAddress();
    error ZeroAmount();
    error BeneficiaryAlreadySet();
    error NoPendingChange();
    error ChangeNotReady(uint256 readyAt);
    error NoColdWallet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != executor) revert NotExecutor();
        _;
    }

    constructor(address owner_, address executor_) {
        if (owner_ == address(0) || executor_ == address(0)) revert ZeroAddress();
        owner = owner_;
        executor = executor_;
        factory = msg.sender;
    }

    /// @notice Sets the first beneficiary at creation, with no delay. Callable once, by the factory only.
    function setInitialBeneficiary(address beneficiary_) external {
        if (msg.sender != factory) revert NotFactory();
        if (beneficiary != address(0)) revert BeneficiaryAlreadySet();
        if (beneficiary_ == address(0)) revert ZeroAddress();
        beneficiary = beneficiary_;
        emit BeneficiaryChanged(beneficiary_);
    }

    // ------------------------------------------------------------------ owner: money in and out

    /// @notice Moves `amount` of `token` from the owner's wallet into the vault (needs an allowance to the vault).
    function deposit(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        _track(token);
        IERC20(token).safeTransferFrom(owner, address(this), amount);
        emit Deposited(owner, token, amount);
    }

    /// @notice Sends `amount` of `token` back to the owner. Works at any time: pausing and the Guardian never block it.
    function withdraw(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(owner, amount);
        emit Withdrawn(owner, token, amount);
    }

    // ------------------------------------------------------------------ owner: delayed settings

    /// @notice Starts a beneficiary change. It can be applied after `CHANGE_DELAY`. A new proposal restarts the clock.
    function proposeBeneficiary(address newBeneficiary) external onlyOwner {
        if (newBeneficiary == address(0)) revert ZeroAddress();
        pendingBeneficiary = newBeneficiary;
        pendingBeneficiaryReadyAt = block.timestamp + CHANGE_DELAY;
        emit BeneficiaryProposed(newBeneficiary, pendingBeneficiaryReadyAt);
    }

    /// @notice Applies the proposed beneficiary once 24 hours have passed.
    function applyBeneficiary() external onlyOwner {
        address next = pendingBeneficiary;
        if (next == address(0)) revert NoPendingChange();
        if (block.timestamp < pendingBeneficiaryReadyAt) revert ChangeNotReady(pendingBeneficiaryReadyAt);
        beneficiary = next;
        pendingBeneficiary = address(0);
        pendingBeneficiaryReadyAt = 0;
        emit BeneficiaryChanged(next);
    }

    /// @notice Starts a cold-wallet change (address(0) = keep claims in the vault). Applies after `CHANGE_DELAY`.
    function proposeColdWallet(address newColdWallet) external onlyOwner {
        pendingColdWallet = newColdWallet;
        pendingColdWalletReadyAt = block.timestamp + CHANGE_DELAY;
        emit ColdWalletProposed(newColdWallet, pendingColdWalletReadyAt);
    }

    /// @notice Applies the proposed cold wallet once 24 hours have passed.
    function applyColdWallet() external onlyOwner {
        uint256 readyAt = pendingColdWalletReadyAt;
        if (readyAt == 0) revert NoPendingChange();
        if (block.timestamp < readyAt) revert ChangeNotReady(readyAt);
        coldWallet = pendingColdWallet;
        pendingColdWallet = address(0);
        pendingColdWalletReadyAt = 0;
        emit ColdWalletChanged(coldWallet);
    }

    // ------------------------------------------------------------------ executor only

    /// @notice Rule 2: forwards freshly claimed tokens to the owner's cold wallet, so the move never comes from the
    ///         owner's own wallet (V-4).
    function forwardToColdWallet(address token, uint256 amount) external onlyExecutor {
        address to = coldWallet;
        if (to == address(0)) revert NoColdWallet();
        IERC20(token).safeTransfer(to, amount);
        emit ForwardedToColdWallet(token, to, amount);
    }

    /// @notice Guardian release: sends the vault's whole balance of every listed and tracked token to the beneficiary.
    ///         The executor calls this only on a release callback, which the Rulebook sends only after Active ->
    ///         Warning -> a full grace period with no activity.
    function release(address[] calldata tokens) external onlyExecutor {
        for (uint256 i; i < tokens.length; ++i) {
            _track(tokens[i]);
        }
        address to = beneficiary;
        for (uint256 i; i < _tokens.length; ++i) {
            IERC20 token = IERC20(_tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.safeTransfer(to, balance);
                emit Released(to, address(token), balance);
            }
        }
    }

    function trackedTokens() external view returns (address[] memory) {
        return _tokens;
    }

    function _track(address token) internal {
        if (token == address(0)) revert ZeroAddress();
        if (!isTracked[token]) {
            isTracked[token] = true;
            _tokens.push(token);
        }
    }
}
