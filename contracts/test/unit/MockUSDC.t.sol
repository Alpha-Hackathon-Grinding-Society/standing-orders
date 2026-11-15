// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;

    function setUp() public {
        usdc = new MockUSDC();
    }

    function test_hasSixDecimalsAndMints() public {
        assertEq(usdc.decimals(), 6);
        usdc.mint(address(this), 100e6);
        assertEq(usdc.balanceOf(address(this)), 100e6);
    }

    function test_permitSetsAllowance() public {
        (address owner, uint256 key) = makeAddrAndKey("owner");
        address spender = makeAddr("executor");
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                500e6,
                usdc.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);

        usdc.permit(owner, spender, 500e6, deadline, v, r, s);
        assertEq(usdc.allowance(owner, spender), 500e6);
        assertEq(usdc.nonces(owner), 1);
    }
}
