// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AbstractCallback} from "@reactive/src/base/AbstractCallback.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {IVestingWallet} from "./interfaces/IVestingWallet.sol";
import {SavingsVault} from "./SavingsVault.sol";

/// @title Steward's callback receiver on Base: carries out what each user's Rulebook decides.
/// @notice One shared executor for all users. A callback is accepted only when:
///         1. it comes from the Reactive callback proxy (`onlyServiceProvider`),
///         2. its injected sender is the Rulebook that this user registered when creating their vault,
///         3. the user is registered, 4. the nonce is unused, and 5. the user is not paused.
///         Funds only ever move from the user's wallet into the user's own vault (within the allowances the user
///         signed), from the vault to the user's cold wallet, or from the vault to the beneficiary on a release.
/// @dev In Reactive Omni the network injects the *reactive contract's* address as the first callback argument, so
///      the library's single immutable `_CALLBACK_SENDER` can't serve a Rulebook per user. We pass `address(0)` for
///      it, never use `onlyCallbackSender`, and check `rulebookOf(user)` instead (docs/NOTES.md, Design impact A).
///      Callback fees are paid in ETH from this contract's balance (Design impact B); anyone can call `coverDebt`.
contract OrdersExecutor is AbstractCallback {
    using SafeERC20 for IERC20;

    struct Registration {
        address vault;
        address token;
        address rulebook;
    }

    /// @notice The factory that deployed this executor; the only caller allowed to register users.
    address public immutable factory;

    mapping(address user => Registration) internal _registrations;
    mapping(address user => mapping(uint256 nonce => bool)) public nonceUsed;
    mapping(address user => bool) public paused;

    event UserRegistered(address indexed user, address indexed vault, address indexed rulebook, address token);
    event SplitExecuted(address indexed user, address indexed vault, uint256 amount, uint256 nonce);
    event ClaimExecuted(
        address indexed user,
        address indexed vesting,
        address indexed token,
        uint256 amount,
        bool toColdWallet,
        uint256 nonce
    );
    event NothingToClaim(address indexed user, address indexed vesting, uint256 nonce);
    event VaultReleased(address indexed user, address indexed vault, uint256 nonce);
    /// @notice The user paused every rule. Counts as Guardian activity.
    event Paused(address indexed user);
    /// @notice The user resumed their rules. Counts as Guardian activity.
    event Unpaused(address indexed user);

    error NotFactory();
    error AlreadyRegistered(address user);
    error UnknownUser(address user);
    error WrongRulebook(address sender, address expected);
    error NonceUsed(address user, uint256 nonce);
    error UserPaused(address user);
    error WrongToken(address token, address expected);
    error WrongVestingBeneficiary(address vesting, address beneficiary);
    error AlreadyPaused();
    error NotPaused();

    constructor(IPayable callbackProxy) AbstractCallback(callbackProxy, address(0)) {
        factory = msg.sender;
    }

    // ------------------------------------------------------------------ registration

    /// @notice Records a new user's vault, token and Rulebook. Called by the factory inside `createVault`.
    function registerUser(address user, address vault, address token, address rulebook) external {
        if (msg.sender != factory) revert NotFactory();
        if (_registrations[user].vault != address(0)) revert AlreadyRegistered(user);
        _registrations[user] = Registration({vault: vault, token: token, rulebook: rulebook});
        emit UserRegistered(user, vault, rulebook, token);
    }

    function registrationOf(address user) external view returns (Registration memory) {
        return _registrations[user];
    }

    function rulebookOf(address user) external view returns (address) {
        return _registrations[user].rulebook;
    }

    // ------------------------------------------------------------------ callbacks

    /// @notice Rule 1: moves `amount` of the user's income token from their wallet into their vault.
    /// @param rvmId Injected by the network: the Rulebook that requested this callback.
    function split(address rvmId, address user, address token, uint256 amount, uint256 nonce)
        external
        onlyServiceProvider
    {
        Registration memory reg = _authorize(rvmId, user, nonce);
        if (token != reg.token) revert WrongToken(token, reg.token);
        IERC20(token).safeTransferFrom(user, reg.vault, amount);
        emit SplitExecuted(user, reg.vault, amount, nonce);
    }

    /// @notice Rule 2: releases whatever `vesting` has vested for the user and moves exactly that amount from the
    ///         user's wallet into their vault (and on to their cold wallet if they set one). Does nothing when zero.
    /// @dev `release` pays the vesting wallet's owner, so we require that owner to be the user; the pull then relies on
    ///      the one-time approval the user gave this executor for `token` (C-2, V-4).
    function claim(address rvmId, address user, address vesting, address token, uint256 nonce)
        external
        onlyServiceProvider
    {
        Registration memory reg = _authorize(rvmId, user, nonce);
        if (IVestingWallet(vesting).owner() != user) revert WrongVestingBeneficiary(vesting, user);

        uint256 amount = IVestingWallet(vesting).releasable(token);
        if (amount == 0) {
            emit NothingToClaim(user, vesting, nonce);
            return;
        }
        IVestingWallet(vesting).release(token);
        IERC20(token).safeTransferFrom(user, reg.vault, amount);

        bool toColdWallet = SavingsVault(reg.vault).coldWallet() != address(0);
        if (toColdWallet) SavingsVault(reg.vault).forwardToColdWallet(token, amount);
        emit ClaimExecuted(user, vesting, token, amount, toColdWallet, nonce);
    }

    /// @notice Guardian: sends the user's whole vault to their beneficiary. The Rulebook asks for this only after
    ///         Active -> Warning -> a full grace period with no activity.
    function release(address rvmId, address user, address[] calldata tokens, uint256 nonce)
        external
        onlyServiceProvider
    {
        Registration memory reg = _authorize(rvmId, user, nonce);
        SavingsVault(reg.vault).release(tokens);
        emit VaultReleased(user, reg.vault, nonce);
    }

    // ------------------------------------------------------------------ user controls

    /// @notice Stops every rule for the caller. Withdrawals from the vault keep working.
    function pause() external {
        _requireRegistered(msg.sender);
        if (paused[msg.sender]) revert AlreadyPaused();
        paused[msg.sender] = true;
        emit Paused(msg.sender);
    }

    /// @notice Resumes the caller's rules.
    function unpause() external {
        _requireRegistered(msg.sender);
        if (!paused[msg.sender]) revert NotPaused();
        paused[msg.sender] = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Pays any callback debt owed to the proxy from this contract's ETH balance. Anyone may call it.
    function coverDebt() external {
        _coverDebt();
    }

    // ------------------------------------------------------------------ internal

    /// @dev Checks 2-5 from the contract notice, in that order, and burns the nonce. Check 1 is the modifier.
    function _authorize(address rvmId, address user, uint256 nonce) internal returns (Registration memory reg) {
        reg = _registrations[user];
        if (reg.vault == address(0)) revert UnknownUser(user);
        if (rvmId != reg.rulebook) revert WrongRulebook(rvmId, reg.rulebook);
        if (nonceUsed[user][nonce]) revert NonceUsed(user, nonce);
        if (paused[user]) revert UserPaused(user);
        nonceUsed[user][nonce] = true;
    }

    function _requireRegistered(address user) internal view {
        if (_registrations[user].vault == address(0)) revert UnknownUser(user);
    }
}
