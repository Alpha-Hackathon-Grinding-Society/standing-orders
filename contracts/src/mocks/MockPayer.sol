// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Test "employer" for testnet runs: holds test USDC and pays it out on request.
/// @notice End-to-end scripts deploy two of these, one listed as an income sender and one not, so the Rulebook sees
///         real `Transfer` events from distinct senders without extra funded wallets. Anyone may call `pay`: it only
///         ever spends this contract's own test tokens.
contract MockPayer {
    event Paid(address indexed token, address indexed to, uint256 amount);

    function pay(IERC20 token, address to, uint256 amount) external {
        require(token.transfer(to, amount), "transfer failed");
        emit Paid(address(token), to, amount);
    }
}
