// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title Test USDC for Base Sepolia.
/// @notice Six decimals and EIP-2612 permit, like real USDC. Anyone can mint: it is a testnet token only.
contract MockUSDC is ERC20, ERC20Permit {
    constructor() ERC20("Steward Test USDC", "USDC") ERC20Permit("Steward Test USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint test tokens to any address.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
