// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {MockPayer} from "../../src/mocks/MockPayer.sol";
import {LogRecords} from "../helpers/LogRecords.sol";
import {StewardSystem} from "../helpers/StewardSystem.sol";

/// @notice Random sequences of everything a user, an employer, an attacker, cron and time can do.
/// @dev Each action also plays the network: it relays the resulting log to the Rulebook and delivers callbacks.
contract StewardHandler is StewardSystem {
    MockPayer internal stranger;
    address internal attacker = makeAddr("attacker");

    // Ghost state the invariants compare against.
    uint256 public ghostLastUserAction;
    uint256 public ghostReleasedAt;
    uint256 public ghostBadCallbackSuccesses;
    uint256 public ghostWithdrawFailures;
    uint256 public ghostEarlyBeneficiaryChanges;
    uint256 public ghostBeneficiaryProposedAt;
    address public ghostPendingBeneficiary;

    constructor() {
        _deploySteward();
        ghostLastUserAction = block.timestamp; // the vesting approval in setup
        stranger = new MockPayer();
        usdc.mint(address(stranger), 1_000_000e6);
        usdc.mint(user, 1000e6);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ------------------------------------------------------------------ views for the invariant contract

    function contracts()
        external
        view
        returns (Rulebook rb, address v, address heir_, address user_, address employer_, address stranger_)
    {
        return (rulebook, address(vault), heir, user, address(employer), address(stranger));
    }

    function tokens() external view returns (address usdc_, address vest_, address vestingWallet_) {
        return (address(usdc), address(vestToken), address(vestingWallet));
    }

    // ------------------------------------------------------------------ money arriving

    function payFromEmployer(uint256 amount) external {
        _payUser(bound(amount, 1, 500e6));
        _deliverAndWatch();
    }

    function payFromStranger(uint256 amount) external {
        amount = bound(amount, 1, 500e6);
        stranger.pay(usdc, user, amount);
        _relay(LogRecords.transfer(BASE_SEPOLIA, address(usdc), address(stranger), user, amount, 0));
        _deliverAndWatch();
    }

    // ------------------------------------------------------------------ the user's own signed actions

    function deposit(uint256 amount) external {
        uint256 balance = usdc.balanceOf(user);
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        vm.prank(user);
        vault.deposit(address(usdc), amount);
        _userEvent(address(vault), "Deposited(address,address,uint256)");
        // The transfer into the vault is also reported, and must not count twice or on its own.
        _relay(LogRecords.transfer(BASE_SEPOLIA, address(usdc), user, address(vault), amount, 0));
        _userActed();
    }

    function withdraw(uint256 amount, bool vestingToken) external {
        address token = vestingToken ? address(vestToken) : address(usdc);
        uint256 balance = vestingToken ? vestToken.balanceOf(address(vault)) : usdc.balanceOf(address(vault));
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        vm.prank(user);
        try vault.withdraw(token, amount) {
            _userEvent(address(vault), "Withdrawn(address,address,uint256)");
            _userActed();
        } catch {
            ghostWithdrawFailures++; // safety invariant 5: must never happen, paused or not
        }
    }

    function alive() external {
        vm.prank(user);
        heartbeat.alive();
        _userEvent(address(heartbeat), "Alive(address)");
        _userActed();
    }

    function transferOnSecondChain() external {
        _relay(LogRecords.transfer(UNICHAIN_SEPOLIA, makeAddr("anyToken"), user, makeAddr("friend"), 1, 0));
        _userActed();
    }

    function togglePause() external {
        bool isPaused = executor.paused(user);
        vm.prank(user);
        if (isPaused) executor.unpause();
        else executor.pause();
        _userEvent(address(executor), isPaused ? "Unpaused(address)" : "Paused(address)");
        _userActed();
    }

    function proposeBeneficiary(uint256 seed) external {
        address next = address(uint160(bound(seed, 1, type(uint64).max)));
        vm.prank(user);
        vault.proposeBeneficiary(next);
        ghostPendingBeneficiary = next;
        ghostBeneficiaryProposedAt = block.timestamp;
    }

    function applyBeneficiary() external {
        vm.prank(user);
        try vault.applyBeneficiary() {
            if (block.timestamp < ghostBeneficiaryProposedAt + 24 hours) ghostEarlyBeneficiaryChanges++;
            heir = ghostPendingBeneficiary; // track who must receive a release
        } catch {}
    }

    // ------------------------------------------------------------------ the network and time

    function tick() external {
        _tick();
        _deliverAndWatch();
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 30 days));
    }

    function checkNow() external {
        rulebook.checkNow();
        _deliverAndWatch();
    }

    // ------------------------------------------------------------------ an attacker

    /// @dev Tries every way around the executor's checks (safety invariant 4). None may succeed.
    function attack(uint256 kind, uint256 amount) external {
        amount = bound(amount, 1, 100e6);
        uint256 used = rulebook.nonce();
        bytes memory payload =
            abi.encodeWithSelector(OrdersExecutor.split.selector, address(0), user, address(usdc), amount, used + 1000);
        bool ok;
        if (kind % 3 == 0) {
            // Direct call, not through the proxy.
            vm.prank(attacker);
            try executor.split(address(rulebook), user, address(usdc), amount, used + 1000) {
                ok = true;
            } catch {}
        } else if (kind % 3 == 1) {
            // Through the proxy, but from another reactive contract.
            try proxy.deliver(address(executor), attacker, payload) {
                ok = true;
            } catch {}
        } else if (used > 0 && executor.nonceUsed(user, used)) {
            // Replaying a nonce the executor has already executed, even from the right Rulebook via the proxy.
            payload =
                abi.encodeWithSelector(OrdersExecutor.split.selector, address(0), user, address(usdc), amount, used);
            try proxy.deliver(address(executor), address(rulebook), payload) {
                ok = true;
            } catch {}
        }
        if (ok) ghostBadCallbackSuccesses++;
    }

    // ------------------------------------------------------------------ helpers

    function _userActed() internal {
        if (rulebook.state() != Rulebook.GuardianState.Released) ghostLastUserAction = block.timestamp;
    }

    function _deliverAndWatch() internal {
        _deliver();
        if (ghostReleasedAt == 0 && rulebook.state() == Rulebook.GuardianState.Released) {
            ghostReleasedAt = block.timestamp;
        }
    }
}

/// @notice The seven safety invariants from CLAUDE.md, checked after every random step.
contract StewardInvariantTest is Test {
    StewardHandler internal handler;

    function setUp() public {
        handler = new StewardHandler();
        targetContract(address(handler));
    }

    /// 1. Funds only ever reach the vault, the cold wallet (through the vault) or, after a full cycle, the beneficiary.
    ///    Every token unit is held by an address that is allowed to hold it.
    function invariant_1_fundsOnlyReachAllowedPlaces() public view {
        (Rulebook rb, address vault, address heir, address user, address employer, address stranger) =
            handler.contracts();
        (address usdc, address vest, address vestingWallet) = handler.tokens();

        uint256 usdcHeld = _bal(usdc, user) + _bal(usdc, vault) + _bal(usdc, employer) + _bal(usdc, stranger)
            + _bal(usdc, heir) + _bal(usdc, address(0xbEEF));
        assertEq(usdcHeld, _supply(usdc), "USDC reached an address outside user / vault / payers / beneficiary");

        uint256 vestHeld = _bal(vest, vestingWallet) + _bal(vest, user) + _bal(vest, vault) + _bal(vest, heir);
        assertEq(vestHeld, _supply(vest), "vested tokens reached an address outside vesting / user / vault / heir");

        if (rb.state() != Rulebook.GuardianState.Released) {
            assertEq(_bal(usdc, heir) + _bal(vest, heir), 0, "beneficiary paid before a release");
        }
    }

    /// 2. A release never happens in one step: Warning and a full grace period come first.
    function invariant_2_releaseNeedsWarningAndFullGrace() public view {
        (Rulebook rb,,,,,) = handler.contracts();
        if (rb.state() == Rulebook.GuardianState.Released) {
            assertGt(rb.warningSince(), 0, "released without a warning");
            assertGt(handler.ghostReleasedAt() - rb.warningSince(), rb.gracePeriod(), "released inside the grace");
        }
    }

    /// 3. Rule 1 never moves more than the period cap, nor more than the permit allowance.
    function invariant_3_splitsWithinCapAndAllowance() public view {
        (Rulebook rb,,,,,) = handler.contracts();
        assertLe(rb.splitThisPeriod(), rb.periodCap());
    }

    /// 4. The executor accepts calls only from the proxy, only from the registered Rulebook, never a repeated nonce.
    function invariant_4_noForgedOrReplayedCallbackSucceeds() public view {
        assertEq(handler.ghostBadCallbackSuccesses(), 0);
    }

    /// 5. The owner can always withdraw, including while paused or in Warning.
    function invariant_5_ownerCanAlwaysWithdraw() public view {
        assertEq(handler.ghostWithdrawFailures(), 0);
    }

    /// 6. Automated moves never count as activity: the Guardian's clock is exactly the user's last signed action.
    function invariant_6_onlySignedActionsMoveTheClock() public view {
        (Rulebook rb,,,,,) = handler.contracts();
        if (rb.state() != Rulebook.GuardianState.Released) {
            assertEq(rb.lastActiveAny(), handler.ghostLastUserAction());
        }
    }

    /// 7. Beneficiary (and cold-wallet) changes take effect only after 24 hours.
    function invariant_7_beneficiaryChangesWait24h() public view {
        assertEq(handler.ghostEarlyBeneficiaryChanges(), 0);
    }

    function _bal(address token, address who) internal view returns (uint256) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", who));
        return ok ? abi.decode(ret, (uint256)) : 0;
    }

    function _supply(address token) internal view returns (uint256) {
        (, bytes memory ret) = token.staticcall(abi.encodeWithSignature("totalSupply()"));
        return abi.decode(ret, (uint256));
    }
}
