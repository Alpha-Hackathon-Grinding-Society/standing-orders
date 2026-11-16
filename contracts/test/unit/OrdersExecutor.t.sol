// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AbstractPayer} from "@reactive/src/base/AbstractPayer.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {RULEBOOK_CALLBACK_GAS} from "../../src/Rulebook.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockToken} from "../../src/mocks/MockToken.sol";
import {MockVestingWallet} from "../../src/mocks/MockVestingWallet.sol";
import {SavingsVault} from "../../src/SavingsVault.sol";
import {MockCallbackProxy} from "../mocks/MockCallbackProxy.sol";
import {Permits} from "../helpers/Permits.sol";

contract OrdersExecutorTest is Test {
    uint256 internal constant CAP = 500e6;

    MockUSDC internal usdc;
    MockCallbackProxy internal proxy;
    VaultFactory internal factory;
    OrdersExecutor internal executor;
    address internal vault;

    address internal user;
    uint256 internal userKey;
    address internal rulebook = makeAddr("rulebook");

    function setUp() public {
        (user, userKey) = makeAddrAndKey("user");
        usdc = new MockUSDC();
        proxy = new MockCallbackProxy();
        factory = new VaultFactory(IPayable(payable(address(proxy))));
        executor = factory.executor();
        vm.deal(address(executor), 1 ether);

        VaultFactory.Permit memory p = Permits.sign(vm, usdc, userKey, address(executor), CAP, block.timestamp + 1);
        vm.prank(user);
        vault = factory.createVault(
            VaultFactory.VaultConfig({token: address(usdc), rulebook: rulebook, beneficiary: makeAddr("heir")}), p
        );
        usdc.mint(user, 1000e6);
    }

    function _splitPayload(address forUser, address token, uint256 amount, uint256 nonce)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSelector(OrdersExecutor.split.selector, address(0), forUser, token, amount, nonce);
    }

    function _deliverSplit(uint256 amount, uint256 nonce) internal {
        proxy.deliver(address(executor), rulebook, _splitPayload(user, address(usdc), amount, nonce));
    }

    function test_S3_splitMovesFundsIntoVault() public {
        vm.expectEmit(address(executor));
        emit OrdersExecutor.SplitExecuted(user, vault, 20e6, 1);
        _deliverSplit(20e6, 1);
        assertEq(usdc.balanceOf(vault), 20e6);
        assertEq(usdc.balanceOf(user), 980e6);
        assertEq(usdc.allowance(user, address(executor)), CAP - 20e6);
        assertTrue(executor.nonceUsed(user, 1));
    }

    function test_executorRejectsNonProxySender() public {
        vm.prank(rulebook);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, rulebook, address(proxy)));
        executor.split(rulebook, user, address(usdc), 1, 1);
    }

    function test_executorRejectsWrongReactVmId() public {
        address otherRulebook = makeAddr("otherRulebook");
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.WrongRulebook.selector, otherRulebook, rulebook));
        proxy.deliver(address(executor), otherRulebook, _splitPayload(user, address(usdc), 1, 1));

        // The user's own wallet is not their Rulebook either (Omni injects the reactive contract's address).
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.WrongRulebook.selector, user, rulebook));
        proxy.deliver(address(executor), user, _splitPayload(user, address(usdc), 1, 1));
    }

    function test_executorRejectsUnknownUser() public {
        address nobody = makeAddr("nobody");
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.UnknownUser.selector, nobody));
        proxy.deliver(address(executor), rulebook, _splitPayload(nobody, address(usdc), 1, 1));
    }

    function test_executorRejectsReplayedNonce() public {
        _deliverSplit(10e6, 7);
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.NonceUsed.selector, user, 7));
        _deliverSplit(10e6, 7);
        assertEq(usdc.balanceOf(vault), 10e6);
    }

    function test_executorRejectsPausedUser() public {
        vm.expectEmit(address(executor));
        emit OrdersExecutor.Paused(user);
        vm.prank(user);
        executor.pause();

        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.UserPaused.selector, user));
        _deliverSplit(10e6, 1);

        vm.expectEmit(address(executor));
        emit OrdersExecutor.Unpaused(user);
        vm.prank(user);
        executor.unpause();
        _deliverSplit(10e6, 1); // the rejected nonce was not burned
        assertEq(usdc.balanceOf(vault), 10e6);
    }

    function test_executorRejectsOtherToken() public {
        MockUSDC other = new MockUSDC();
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.WrongToken.selector, address(other), address(usdc)));
        proxy.deliver(address(executor), rulebook, _splitPayload(user, address(other), 1, 1));
    }

    function test_S3_neverMovesMoreThanAllowance() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(executor), CAP, CAP + 1)
        );
        _deliverSplit(CAP + 1, 1);
        assertEq(usdc.balanceOf(vault), 0);
    }

    function testFuzz_S3_neverMovesMoreThanAllowance(uint256[5] memory amounts) public {
        uint256 moved;
        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = bound(amounts[i], 0, 400e6);
            uint256 left = usdc.allowance(user, address(executor));
            if (amount > left) {
                vm.expectRevert();
                _deliverSplit(amount, i + 1);
            } else {
                _deliverSplit(amount, i + 1);
                moved += amount;
            }
            assertLe(usdc.balanceOf(vault), CAP);
        }
        assertEq(usdc.balanceOf(vault), moved);
    }

    function test_U3_pauseIsForRegisteredUsersAndTogglesOnce() public {
        address nobody = makeAddr("nobody");
        vm.prank(nobody);
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.UnknownUser.selector, nobody));
        executor.pause();

        vm.startPrank(user);
        vm.expectRevert(OrdersExecutor.NotPaused.selector);
        executor.unpause();
        executor.pause();
        vm.expectRevert(OrdersExecutor.AlreadyPaused.selector);
        executor.pause();
        vm.stopPrank();
    }

    function test_coverDebtPaysTheProxyInEth() public {
        proxy.setDebt(address(executor), 0.01 ether);
        executor.coverDebt();
        assertEq(address(proxy).balance, 0.01 ether);
    }

    /// @dev Phase 1 lesson: the callback gas limit covers the whole destination tx and the proxy keeps ~160k of it.
    function test_callbackGasCoversSplitPlusProxyOverhead() public {
        uint256 proxyOverhead = 80_000 + 50_000 + 30_000;
        bytes memory payload = _splitPayload(user, address(usdc), 20e6, 1);
        uint256 before = gasleft();
        proxy.deliver(address(executor), rulebook, payload);
        uint256 splitGas = before - gasleft();
        assertLe(splitGas + proxyOverhead, RULEBOOK_CALLBACK_GAS);
    }

    // ------------------------------------------------------------------ Rule 2: claim

    function _vesting(address beneficiary) internal returns (MockVestingWallet w, MockToken t) {
        t = new MockToken("Vested", "VEST");
        w = new MockVestingWallet(beneficiary, uint64(block.timestamp), 100 days);
        t.mint(address(w), 1000e18);
        vm.prank(user);
        t.approve(address(executor), type(uint256).max);
    }

    function _claimPayload(address vesting, address token, uint256 nonce) internal view returns (bytes memory) {
        return abi.encodeWithSelector(OrdersExecutor.claim.selector, address(0), user, vesting, token, nonce);
    }

    function _setColdWallet(address cold) internal {
        vm.prank(user);
        SavingsVault(vault).proposeColdWallet(cold);
        vm.warp(block.timestamp + 24 hours);
        vm.prank(user);
        SavingsVault(vault).applyColdWallet();
    }

    function test_C2_zeroReleasableIsNoop() public {
        (MockVestingWallet w, MockToken t) = _vesting(user);
        vm.expectEmit(address(executor));
        emit OrdersExecutor.NothingToClaim(user, address(w), 1);
        proxy.deliver(address(executor), rulebook, _claimPayload(address(w), address(t), 1));
        assertEq(t.balanceOf(vault), 0);
        assertEq(t.balanceOf(address(w)), 1000e18);
    }

    function test_C2_claimMovesVestedToVault() public {
        (MockVestingWallet w, MockToken t) = _vesting(user);
        vm.warp(block.timestamp + 10 days);
        vm.expectEmit(address(executor));
        emit OrdersExecutor.ClaimExecuted(user, address(w), address(t), 100e18, false, 1);
        proxy.deliver(address(executor), rulebook, _claimPayload(address(w), address(t), 1));
        assertEq(t.balanceOf(vault), 100e18);
        assertEq(t.balanceOf(user), 0);
        assertEq(w.released(address(t)), 100e18);
    }

    function test_V4_claimGoesThroughVaultToColdWallet() public {
        (MockVestingWallet w, MockToken t) = _vesting(user);
        address cold = makeAddr("cold");
        _setColdWallet(cold);
        vm.warp(block.timestamp + 9 days); // 10 days vested in total

        proxy.deliver(address(executor), rulebook, _claimPayload(address(w), address(t), 1));
        assertEq(t.balanceOf(cold), 100e18);
        assertEq(t.balanceOf(vault), 0);
        assertEq(t.balanceOf(user), 0);
    }

    function test_C2_claimRejectsVestingForSomeoneElse() public {
        (MockVestingWallet w, MockToken t) = _vesting(makeAddr("someoneElse"));
        vm.warp(block.timestamp + 10 days);
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.WrongVestingBeneficiary.selector, address(w), user));
        proxy.deliver(address(executor), rulebook, _claimPayload(address(w), address(t), 1));
    }

    function test_C2_claimHasTheSameAuthChecks() public {
        (MockVestingWallet w, MockToken t) = _vesting(user);
        address impostor = makeAddr("impostor");
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.WrongRulebook.selector, impostor, rulebook));
        proxy.deliver(address(executor), impostor, _claimPayload(address(w), address(t), 1));

        vm.prank(rulebook);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, rulebook, address(proxy)));
        executor.claim(rulebook, user, address(w), address(t), 1);
    }

    function test_callbackGasCoversClaimWithColdWalletPlusProxyOverhead() public {
        (MockVestingWallet w, MockToken t) = _vesting(user);
        _setColdWallet(makeAddr("cold"));
        vm.warp(block.timestamp + 9 days);

        bytes memory payload = _claimPayload(address(w), address(t), 1);
        uint256 before = gasleft();
        proxy.deliver(address(executor), rulebook, payload);
        assertLe(before - gasleft() + 160_000, RULEBOOK_CALLBACK_GAS);
    }

    // ------------------------------------------------------------------ Guardian: release

    function _releasePayload(uint256 nonce) internal view returns (bytes memory) {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        return abi.encodeWithSelector(OrdersExecutor.release.selector, address(0), user, tokens, nonce);
    }

    function test_releaseSendsVaultToBeneficiary() public {
        _deliverSplit(50e6, 1);
        address heir = SavingsVault(vault).beneficiary();
        vm.expectEmit(address(executor));
        emit OrdersExecutor.VaultReleased(user, vault, 2);
        proxy.deliver(address(executor), rulebook, _releasePayload(2));
        assertEq(usdc.balanceOf(heir), 50e6);
        assertEq(usdc.balanceOf(vault), 0);
    }

    function test_releaseHasTheSameAuthChecks() public {
        address impostor = makeAddr("impostor");
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.WrongRulebook.selector, impostor, rulebook));
        proxy.deliver(address(executor), impostor, _releasePayload(1));

        vm.prank(user);
        executor.pause();
        vm.expectRevert(abi.encodeWithSelector(OrdersExecutor.UserPaused.selector, user));
        proxy.deliver(address(executor), rulebook, _releasePayload(1));
    }
}
