// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title One user's savings vault on Base.
/// @notice The owner can deposit and withdraw at any time, including while their rules are paused. Only the
///         executor can move funds anywhere else, and only to the cold wallet or, after a full Guardian cycle, the
///         beneficiary (both implemented in Phase 3). A beneficiary change takes effect only after 24 hours.
/// @dev Deployed by `VaultFactory` with CREATE2 (salt = owner), so its address is known before setup is signed.
contract SavingsVault {
    using SafeERC20 for IERC20;

    /// @notice Delay before a proposed beneficiary takes effect (V-3, safety invariant 7).
    uint256 public constant CHANGE_DELAY = 24 hours;

    address public immutable owner;
    address public immutable executor;
    address public immutable factory;

    address public beneficiary;
    address public pendingBeneficiary;
    uint256 public pendingBeneficiaryReadyAt;

    /// @notice Owner deposit. Counts as Guardian activity.
    event Deposited(address indexed owner, address indexed token, uint256 amount);
    /// @notice Owner withdrawal. Counts as Guardian activity.
    event Withdrawn(address indexed owner, address indexed token, uint256 amount);
    event BeneficiaryProposed(address indexed beneficiary, uint256 readyAt);
    event BeneficiaryChanged(address indexed beneficiary);

    error NotOwner();
    error NotExecutor();
    error NotFactory();
    error ZeroAddress();
    error ZeroAmount();
    error BeneficiaryAlreadySet();
    error NoPendingChange();
    error ChangeNotReady(uint256 readyAt);
    error NotImplemented();

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

    /// @notice Moves `amount` of `token` from the owner's wallet into the vault (needs an allowance to the vault).
    function deposit(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(owner, address(this), amount);
        emit Deposited(owner, token, amount);
    }

    /// @notice Sends `amount` of `token` back to the owner. Works at any time: pausing and the Guardian never block it.
    function withdraw(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(owner, amount);
        emit Withdrawn(owner, token, amount);
    }

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

    /// @notice Phase 3: sends every listed token balance to the beneficiary after a full Guardian cycle.
    function release(address[] calldata) external view onlyExecutor {
        revert NotImplemented();
    }

    /// @notice Phase 3: forwards claimed tokens to the owner's chosen cold wallet.
    function forwardToColdWallet(address, uint256) external view onlyExecutor {
        revert NotImplemented();
    }
}
