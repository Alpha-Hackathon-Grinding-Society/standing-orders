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

contract VaultFactoryTest is Test {
    MockUSDC internal usdc;
    VaultFactory internal factory;
    OrdersExecutor internal executor;

    address internal user;
    uint256 internal userKey;
    address internal rulebook = makeAddr("rulebook");
    address internal heir = makeAddr("heir");

    function setUp() public {
        (user, userKey) = makeAddrAndKey("user");
        usdc = new MockUSDC();
        factory = new VaultFactory(IPayable(payable(address(new MockCallbackProxy()))));
        executor = factory.executor();
    }

    function _config() internal view returns (VaultFactory.VaultConfig memory) {
        return VaultFactory.VaultConfig({token: address(usdc), rulebook: rulebook, beneficiary: heir});
    }

    function _permit(uint256 value) internal view returns (VaultFactory.Permit memory) {
        return Permits.sign(vm, usdc, userKey, address(executor), value, block.timestamp + 1 hours);
    }

    function _create(uint256 cap) internal returns (address) {
        VaultFactory.Permit memory p = _permit(cap);
        vm.prank(user);
        return factory.createVault(_config(), p);
    }

    function test_F2_createVaultAppliesPermitAndRegisters() public {
        address predicted = factory.predictVault(user);
        vm.expectEmit(address(factory));
        emit VaultFactory.VaultCreated(user, predicted, rulebook, address(usdc), 500e6);
        address vault = _create(500e6);

        assertEq(vault, predicted);
        assertEq(factory.vaultOf(user), vault);
        assertEq(usdc.allowance(user, address(executor)), 500e6);

        OrdersExecutor.Registration memory reg = executor.registrationOf(user);
        assertEq(reg.vault, vault);
        assertEq(reg.token, address(usdc));
        assertEq(reg.rulebook, rulebook);
        assertEq(executor.rulebookOf(user), rulebook);

        SavingsVault v = SavingsVault(vault);
        assertEq(v.owner(), user);
        assertEq(v.executor(), address(executor));
        assertEq(v.beneficiary(), heir);
    }

    function test_F2_secondVaultReverts() public {
        address vault = _create(500e6);
        VaultFactory.Permit memory p = _permit(1);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(VaultFactory.VaultExists.selector, vault));
        factory.createVault(_config(), p);
    }

    function test_F2_vaultAddressPredictable() public {
        address other = makeAddr("other");
        address predictedUser = factory.predictVault(user);
        address predictedOther = factory.predictVault(other);
        assertTrue(predictedUser != predictedOther);
        assertEq(_create(1), predictedUser);
    }

    function test_F2_frontRunPermitStillWorks() public {
        // Someone copies the permit from the mempool and submits it first; the allowance is set either way.
        VaultFactory.Permit memory p = _permit(500e6);
        usdc.permit(user, address(executor), p.value, p.deadline, p.v, p.r, p.s);

        vm.prank(user);
        factory.createVault(_config(), p);
        assertEq(usdc.allowance(user, address(executor)), 500e6);
    }

    function test_F2_badPermitReverts() public {
        VaultFactory.Permit memory p = _permit(500e6);
        p.value = 600e6; // signature no longer matches and no allowance exists
        vm.prank(user);
        vm.expectRevert(VaultFactory.PermitFailed.selector);
        factory.createVault(_config(), p);
    }

    function test_F2_zeroAddressesRevert() public {
        VaultFactory.Permit memory p = _permit(1);
        VaultFactory.VaultConfig memory c = _config();
        c.rulebook = address(0);
        vm.prank(user);
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        factory.createVault(c, p);

        c = _config();
        c.beneficiary = address(0);
        vm.prank(user);
        vm.expectRevert(SavingsVault.ZeroAddress.selector);
        factory.createVault(c, p);
    }

    function test_F2_onlyFactoryRegistersUsers() public {
        vm.expectRevert(OrdersExecutor.NotFactory.selector);
        executor.registerUser(user, address(1), address(usdc), rulebook);
        assertEq(executor.factory(), address(factory));
    }
}
