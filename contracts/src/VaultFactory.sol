// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {OrdersExecutor} from "./OrdersExecutor.sol";
import {SavingsVault} from "./SavingsVault.sol";

/// @title Creates each user's SavingsVault on Base and registers them with the shared executor.
/// @notice Setup order (docs/NOTES.md, Design impact A): the user first deploys their Rulebook on Reactive, pointing
///         at `predictVault(user)`, then calls `createVault` here with that Rulebook's address and a USDC permit.
/// @dev The factory deploys the executor in its constructor, so the executor trusts exactly one factory and neither
///      contract needs an admin key.
contract VaultFactory {
    struct VaultConfig {
        /// @dev Income token the executor may pull for Rule 1 (USDC).
        address token;
        /// @dev The user's Rulebook on Reactive; the only callback sender the executor will accept for this user.
        address rulebook;
        /// @dev Receives the vault after a full Guardian cycle. Later changes wait 24 hours.
        address beneficiary;
    }

    /// @notice EIP-2612 permit giving the executor an allowance of `value` (the user's total Rule 1 budget).
    struct Permit {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    OrdersExecutor public immutable executor;

    mapping(address owner => address vault) public vaultOf;

    event VaultCreated(
        address indexed owner, address indexed vault, address indexed rulebook, address token, uint256 allowance
    );

    error VaultExists(address vault);
    error ZeroAddress();
    error PermitFailed();

    constructor(IPayable callbackProxy) {
        executor = new OrdersExecutor(callbackProxy);
    }

    /// @notice Creates the caller's vault, applies their USDC permit for the executor and registers them. One per owner.
    function createVault(VaultConfig calldata config, Permit calldata permit) external returns (address vault) {
        address owner = msg.sender;
        if (vaultOf[owner] != address(0)) revert VaultExists(vaultOf[owner]);
        if (config.token == address(0) || config.rulebook == address(0)) revert ZeroAddress();

        vault = address(new SavingsVault{salt: _salt(owner)}(owner, address(executor)));
        vaultOf[owner] = vault;
        SavingsVault(vault).setInitialBeneficiary(config.beneficiary);

        _applyPermit(config.token, owner, permit);
        executor.registerUser(owner, vault, config.token, config.rulebook);

        emit VaultCreated(owner, vault, config.rulebook, config.token, permit.value);
    }

    /// @notice The address `createVault` will give `owner`'s vault. Known before anything is signed.
    function predictVault(address owner) external view returns (address) {
        bytes memory initCode = abi.encodePacked(type(SavingsVault).creationCode, abi.encode(owner, address(executor)));
        return Create2.computeAddress(_salt(owner), keccak256(initCode));
    }

    /// @dev A permit can be front-run by anyone who sees it in the mempool. That only spends the signature, so if the
    ///      call fails we accept the outcome as long as the allowance it was meant to set is in place.
    function _applyPermit(address token, address owner, Permit calldata p) internal {
        try IERC20Permit(token).permit(owner, address(executor), p.value, p.deadline, p.v, p.r, p.s) {}
        catch {
            if (IERC20(token).allowance(owner, address(executor)) < p.value) revert PermitFailed();
        }
    }

    function _salt(address owner) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(owner)));
    }
}
