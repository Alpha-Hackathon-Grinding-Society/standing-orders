// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {SavingsVault} from "../../src/SavingsVault.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockCallbackProxy} from "../mocks/MockCallbackProxy.sol";
import {Permits} from "../helpers/Permits.sol";

contract SavingsVaultTest is Test {
    MockUSDC internal usdc;
    VaultFactory internal factory;
    OrdersExecutor internal executor;
    SavingsVault internal vault;

    address internal user;
    uint256 internal userKey;
    address internal rulebook = makeAddr("rulebook");
    address internal heir = makeAddr("heir");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        (user, userKey) = makeAddrAndKey("user");
        usdc = new MockUSDC();
        factory = new VaultFactory(IPayable(payable(address(new MockCallbackProxy()))));
        executor = factory.executor();

        VaultFactory.Permit memory p = Permits.sign(vm, usdc, userKey, address(executor), 500e6, block.timestamp + 1);
        vm.prank(user);
        vault = SavingsVault(
            factory.createVault(
                VaultFactory.VaultConfig({token: address(usdc), rulebook: rulebook, beneficiary: heir}), p
            )
        );

        usdc.mint(user, 1000e6);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_V1_ownerDepositAndWithdrawEmitEvents() public {
        vm.expectEmit(address(vault));
        emit SavingsVault.Deposited(user, address(usdc), 300e6);
        vm.prank(user);
        vault.deposit(address(usdc), 300e6);
        assertEq(usdc.balanceOf(address(vault)), 300e6);

        vm.expectEmit(address(vault));
        emit SavingsVault.Withdrawn(user, address(usdc), 120e6);
        vm.prank(user);
        vault.withdraw(address(usdc), 120e6);
        assertEq(usdc.balanceOf(address(vault)), 180e6);
        assertEq(usdc.balanceOf(user), 820e6);
    }

    function test_V1_onlyOwnerCanDepositOrWithdraw() public {
        vm.startPrank(stranger);
        vm.expectRevert(SavingsVault.NotOwner.selector);
        vault.deposit(address(usdc), 1);
        vm.expectRevert(SavingsVault.NotOwner.selector);
        vault.withdraw(address(usdc), 1);
        vm.stopPrank();
    }

    function test_V1_zeroAmountsRevert() public {
        vm.startPrank(user);
        vm.expectRevert(SavingsVault.ZeroAmount.selector);
        vault.deposit(address(usdc), 0);
        vm.expectRevert(SavingsVault.ZeroAmount.selector);
        vault.withdraw(address(usdc), 0);
        vm.stopPrank();
    }

    function test_V1_withdrawWorksWhenPaused() public {
        vm.startPrank(user);
        vault.deposit(address(usdc), 100e6);
        executor.pause();
        assertTrue(executor.paused(user));
        vault.withdraw(address(usdc), 100e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(user), 1000e6);
    }

    function test_V1_withdrawGoesOnlyToOwner() public {
        // Funds arriving by any route (here: a direct transfer) can only leave through withdraw, to the owner.
        usdc.mint(address(vault), 50e6);
        vm.prank(user);
        vault.withdraw(address(usdc), 50e6);
        assertEq(usdc.balanceOf(user), 1050e6);
    }

    function test_V3_initialBeneficiaryIsSetAtCreation() public view {
        assertEq(vault.beneficiary(), heir);
        assertEq(vault.owner(), user);
        assertEq(vault.executor(), address(executor));
    }

    function test_V3_beneficiaryChangeWaits24h() public {
        address newHeir = makeAddr("newHeir");
        vm.prank(user);
        vault.proposeBeneficiary(newHeir);
        uint256 readyAt = block.timestamp + 24 hours;
        assertEq(vault.pendingBeneficiaryReadyAt(), readyAt);

        vm.warp(readyAt - 1);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(SavingsVault.ChangeNotReady.selector, readyAt));
        vault.applyBeneficiary();
        assertEq(vault.beneficiary(), heir);

        vm.warp(readyAt);
        vm.expectEmit(address(vault));
        emit SavingsVault.BeneficiaryChanged(newHeir);
        vm.prank(user);
        vault.applyBeneficiary();
        assertEq(vault.beneficiary(), newHeir);
        assertEq(vault.pendingBeneficiary(), address(0));
    }

    function test_V3_newProposalRestartsTheClock() public {
        vm.prank(user);
        vault.proposeBeneficiary(makeAddr("first"));
        vm.warp(block.timestamp + 23 hours);
        vm.prank(user);
        vault.proposeBeneficiary(makeAddr("second"));

        vm.warp(block.timestamp + 2 hours); // 25h after the first, 2h after the second
        vm.prank(user);
        vm.expectRevert();
        vault.applyBeneficiary();
    }

    function test_V3_beneficiaryRulesAreOwnerOnlyAndValidated() public {
        vm.prank(stranger);
        vm.expectRevert(SavingsVault.NotOwner.selector);
        vault.proposeBeneficiary(stranger);

        vm.startPrank(user);
        vm.expectRevert(SavingsVault.ZeroAddress.selector);
        vault.proposeBeneficiary(address(0));
        vm.expectRevert(SavingsVault.NoPendingChange.selector);
        vault.applyBeneficiary();
        vm.stopPrank();
    }

    function test_V3_initialBeneficiaryIsFactoryOnlyAndOnce() public {
        vm.prank(user);
        vm.expectRevert(SavingsVault.NotFactory.selector);
        vault.setInitialBeneficiary(user);

        vm.prank(address(factory));
        vm.expectRevert(SavingsVault.BeneficiaryAlreadySet.selector);
        vault.setInitialBeneficiary(user);
    }

    function test_V2_onlyExecutorReachesReleaseAndColdWallet() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        vm.prank(user);
        vm.expectRevert(SavingsVault.NotExecutor.selector);
        vault.release(tokens);
        vm.prank(user);
        vm.expectRevert(SavingsVault.NotExecutor.selector);
        vault.forwardToColdWallet(address(usdc), 1);

        // Phase 2 stubs: even the executor can't move funds yet.
        vm.startPrank(address(executor));
        vm.expectRevert(SavingsVault.NotImplemented.selector);
        vault.release(tokens);
        vm.expectRevert(SavingsVault.NotImplemented.selector);
        vault.forwardToColdWallet(address(usdc), 1);
        vm.stopPrank();
    }

    function test_constructorRejectsZeroAddresses() public {
        vm.expectRevert(SavingsVault.ZeroAddress.selector);
        new SavingsVault(address(0), address(executor));
        vm.expectRevert(SavingsVault.ZeroAddress.selector);
        new SavingsVault(user, address(0));
    }
}
