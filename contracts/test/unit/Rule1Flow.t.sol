// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {Heartbeat} from "../../src/Heartbeat.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockPayer} from "../../src/mocks/MockPayer.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {MockCallbackProxy} from "../mocks/MockCallbackProxy.sol";
import {LogRecords} from "../helpers/LogRecords.sol";
import {Permits} from "../helpers/Permits.sol";
import {Test} from "forge-std/Test.sol";

/// @notice The whole Rule 1 path in one test, in the real setup order: Rulebook first (pointing at the predicted
///         vault), then createVault, then income -> react -> callback -> executor -> vault.
contract Rule1FlowTest is Test {
    uint256 internal constant BASE_SEPOLIA = 84_532;

    MockSystem internal sys;
    MockCallbackProxy internal proxy;
    MockUSDC internal usdc;
    VaultFactory internal factory;
    OrdersExecutor internal executor;
    MockPayer internal employer;
    MockPayer internal stranger;

    address internal user;
    uint256 internal userKey;

    function setUp() public {
        (user, userKey) = makeAddrAndKey("user");
        vm.etch(ReactiveConstants.SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(payable(ReactiveConstants.SYSTEM));
        proxy = new MockCallbackProxy();
        usdc = new MockUSDC();
        factory = new VaultFactory(IPayable(payable(address(proxy))));
        executor = factory.executor();
        employer = new MockPayer();
        stranger = new MockPayer();
        usdc.mint(address(employer), 1000e6);
        usdc.mint(address(stranger), 1000e6);
    }

    function test_rule1EndToEnd_listedSplitsUnlistedDoesNot() public {
        // 1. Reactive: the user deploys their Rulebook, pointing at the vault address they will get.
        address predictedVault = factory.predictVault(user);
        address[] memory senders = new address[](1);
        senders[0] = address(employer);
        vm.prank(user);
        Rulebook rulebook = new Rulebook(
            Rulebook.Config({
                chainId: BASE_SEPOLIA,
                token: address(usdc),
                executor: address(executor),
                vault: predictedVault,
                splitBps: 2000,
                periodCap: 500e6,
                periodLength: 30 days,
                incomeSenders: senders,
                cronTopic: ReactiveConstants.CRON100
            })
        );

        // 2. Base: permit + createVault registers that Rulebook.
        VaultFactory.Permit memory p = Permits.sign(vm, usdc, userKey, address(executor), 500e6, block.timestamp + 1);
        vm.prank(user);
        address vault = factory.createVault(
            VaultFactory.VaultConfig({
                token: address(usdc), rulebook: address(rulebook), beneficiary: makeAddr("heir")
            }),
            p
        );
        assertEq(vault, predictedVault);

        // 3. Income from the listed employer and from a stranger.
        employer.pay(usdc, user, 100e6);
        stranger.pay(usdc, user, 100e6);
        _relay(rulebook, address(employer), 100e6, 0x1);
        _relay(rulebook, address(stranger), 100e6, 0x2);

        // 4. Only the listed payment produced a callback; deliver it as the network would.
        assertEq(sys.callbackCount(), 1);
        MockSystem.CallbackRequest memory cb = sys.callbackAt(0);
        assertEq(cb.recipient, address(executor));
        proxy.deliver(cb.recipient, cb.requester, cb.payload);

        assertEq(usdc.balanceOf(vault), 20e6);
        assertEq(usdc.balanceOf(user), 180e6);
    }

    function test_heartbeatEmitsAliveForTheCaller() public {
        Heartbeat hb = new Heartbeat();
        vm.expectEmit(address(hb));
        emit Heartbeat.Alive(user);
        vm.prank(user);
        hb.alive();
    }

    function _relay(Rulebook rulebook, address from, uint256 value, uint256 txHash) internal {
        vm.prank(ReactiveConstants.SYSTEM);
        rulebook.react(LogRecords.transfer(BASE_SEPOLIA, address(usdc), from, user, value, txHash));
    }
}
