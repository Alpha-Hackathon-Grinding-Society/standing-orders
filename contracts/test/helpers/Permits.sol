// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Vm} from "forge-std/Vm.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";

/// @title Signs EIP-2612 permits in tests and scripts.
library Permits {
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function sign(Vm vm, IERC20Permit token, uint256 ownerKey, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (VaultFactory.Permit memory p)
    {
        address owner = vm.addr(ownerKey);
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, token.nonces(owner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (p.v, p.r, p.s) = vm.sign(ownerKey, digest);
        p.value = value;
        p.deadline = deadline;
    }
}
