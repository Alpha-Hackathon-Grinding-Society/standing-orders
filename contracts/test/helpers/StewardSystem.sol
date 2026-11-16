// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {SavingsVault} from "../../src/SavingsVault.sol";
import {Heartbeat} from "../../src/Heartbeat.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockToken} from "../../src/mocks/MockToken.sol";
import {MockPayer} from "../../src/mocks/MockPayer.sol";
import {MockVestingWallet} from "../../src/mocks/MockVestingWallet.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {MockCallbackProxy} from "../mocks/MockCallbackProxy.sol";
import {LogRecords} from "./LogRecords.sol";
import {Permits} from "./Permits.sol";

/// @title The whole Steward system in one EVM: real Base contracts, a real OpenZeppelin vesting wallet, the Rulebook,
///        and mocks standing in for Reactive (system contract) and the callback proxy.
/// @dev `relay*` helpers play the network: they turn what happened on "Base" into `react()` calls, and `deliver()`
///      hands every requested callback to the executor through the proxy, exactly as the live loop does.
abstract contract StewardSystem is Test {
    uint256 internal constant BASE_SEPOLIA = 84_532;
    uint256 internal constant UNICHAIN_SEPOLIA = 1301;
    uint256 internal constant LASNA = 5_318_007;
    uint256 internal constant PERMIT_CAP = 1000e6;
    uint256 internal constant PERIOD_CAP = 100e6;
    uint256 internal constant VESTED_TOTAL = 1000e18;
    uint256 internal constant VEST_DURATION = 100 days;
    uint256 internal constant CLAIM_INTERVAL = 1 days;
    uint256 internal constant SILENCE = 90 days;
    uint256 internal constant GRACE = 14 days;
    uint256 internal constant CHECK_INTERVAL = 1 hours;

    MockSystem internal sys;
    MockCallbackProxy internal proxy;
    MockUSDC internal usdc;
    MockToken internal vestToken;
    MockVestingWallet internal vestingWallet;
    VaultFactory internal factory;
    OrdersExecutor internal executor;
    Heartbeat internal heartbeat;
    SavingsVault internal vault;
    Rulebook internal rulebook;
    MockPayer internal employer;

    address internal user;
    uint256 internal userKey;
    address internal heir = makeAddr("heir");

    uint256 internal delivered; // callbacks handed to the executor so far
    uint256 internal txCounter;

    function _deploySteward() internal {
        vm.warp(1_800_000_000);
        (user, userKey) = makeAddrAndKey("user");
        vm.etch(ReactiveConstants.SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(payable(ReactiveConstants.SYSTEM));
        proxy = new MockCallbackProxy();
        usdc = new MockUSDC();
        vestToken = new MockToken("Vested Token", "VEST");
        factory = new VaultFactory(IPayable(payable(address(proxy))));
        executor = factory.executor();
        heartbeat = new Heartbeat();
        employer = new MockPayer();
        usdc.mint(address(employer), 1_000_000e6);

        vestingWallet = new MockVestingWallet(user, uint64(block.timestamp), uint64(VEST_DURATION));
        vestToken.mint(address(vestingWallet), VESTED_TOTAL);

        // Setup order (Design impact A): Rulebook first, at the predicted vault; then permit + createVault on Base.
        address[] memory senders = new address[](1);
        senders[0] = address(employer);
        uint256[] memory chains = new uint256[](2);
        chains[0] = BASE_SEPOLIA;
        chains[1] = UNICHAIN_SEPOLIA;
        address predictedVault = factory.predictVault(user); // read before the prank, which the next call consumes
        vm.chainId(LASNA);
        vm.prank(user);
        rulebook = new Rulebook(
            Rulebook.Config({
                chainId: BASE_SEPOLIA,
                token: address(usdc),
                executor: address(executor),
                vault: predictedVault,
                heartbeat: address(heartbeat),
                splitBps: 2000,
                periodCap: PERIOD_CAP,
                periodLength: 30 days,
                incomeSenders: senders,
                vesting: address(vestingWallet),
                vestingToken: address(vestToken),
                claimInterval: CLAIM_INTERVAL,
                watchedChains: chains,
                silencePeriod: SILENCE,
                gracePeriod: GRACE,
                guardianCheckInterval: CHECK_INTERVAL,
                cronTopic: ReactiveConstants.CRON100
            })
        );

        VaultFactory.Permit memory p = Permits.sign(vm, usdc, userKey, address(executor), PERMIT_CAP, block.timestamp);
        vm.prank(user);
        vault = SavingsVault(
            factory.createVault(
                VaultFactory.VaultConfig({token: address(usdc), rulebook: address(rulebook), beneficiary: heir}), p
            )
        );
        // The one-time approval for Rule 2 is the user's own signed Approval: it counts as activity.
        vm.prank(user);
        vestToken.approve(address(executor), type(uint256).max);
        _relay(LogRecords.approval(BASE_SEPOLIA, address(vestToken), user, address(executor), type(uint256).max, 0));
    }

    // ------------------------------------------------------------------ playing the network

    function _relay(IReactive.LogRecord memory log) internal {
        log.txHash = log.txHash == 0 ? ++txCounter : log.txHash;
        vm.prank(ReactiveConstants.SYSTEM);
        rulebook.react(log);
    }

    function _tick() internal {
        _relay(LogRecords.cron(LASNA, ReactiveConstants.CRON100, block.number));
    }

    /// @dev Delivers every callback requested since the last call. Returns how many reverted on the executor.
    function _deliver() internal returns (uint256 failed) {
        while (delivered < sys.callbackCount()) {
            MockSystem.CallbackRequest memory cb = sys.callbackAt(delivered++);
            try proxy.deliver(cb.recipient, cb.requester, cb.payload) {}
            catch {
                failed++;
            }
        }
    }

    function _userEvent(address emitter, string memory sig) internal {
        IReactive.LogRecord memory log;
        log.chainId = BASE_SEPOLIA;
        log.contractAddress = emitter;
        log.topic0 = uint256(keccak256(bytes(sig)));
        log.topic1 = uint256(uint160(user));
        log.opCode = 2;
        _relay(log);
    }

    /// @dev The employer pays the user on Base, and the Rulebook sees it.
    function _payUser(uint256 amount) internal {
        employer.pay(usdc, user, amount);
        _relay(LogRecords.transfer(BASE_SEPOLIA, address(usdc), address(employer), user, amount, 0));
    }

    /// @dev Moves time forward in check-interval steps, ticking cron and delivering callbacks as the network would.
    function _live(uint256 duration) internal {
        uint256 end = block.timestamp + duration;
        while (block.timestamp < end) {
            uint256 step = end - block.timestamp < CHECK_INTERVAL ? end - block.timestamp : CHECK_INTERVAL;
            vm.warp(block.timestamp + step);
            _tick();
            _deliver();
        }
    }
}
