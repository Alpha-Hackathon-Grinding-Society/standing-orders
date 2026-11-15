// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";
import {OrdersExecutor} from "../../src/OrdersExecutor.sol";
import {Permits} from "../helpers/Permits.sol";

/// @notice Runs Rule 1's Base side against real USDC on a Base mainnet fork.
///         Skipped unless BASE_RPC is set:  BASE_RPC=https://mainnet.base.org forge test --match-path "test/fork/*"
contract RealUsdcForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant BASE_CALLBACK_PROXY = 0xCc780DdE33f56f55dE778D42c930959374a4a068;
    bytes32 internal constant APPROVAL_TOPIC = keccak256("Approval(address,address,uint256)");

    VaultFactory internal factory;
    OrdersExecutor internal executor;
    address internal user;
    uint256 internal userKey;
    address internal rulebook = makeAddr("rulebook");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        (user, userKey) = makeAddrAndKey("forkUser");
        factory = new VaultFactory(IPayable(payable(BASE_CALLBACK_PROXY)));
        executor = factory.executor();
        deal(BASE_USDC, user, 1000e6);
    }

    function test_fork_realUsdcPermitAndSplitPullEmitNoApproval() public {
        VaultFactory.Permit memory p =
            Permits.sign(vm, IERC20Permit(BASE_USDC), userKey, address(executor), 500e6, block.timestamp + 1 hours);
        vm.prank(user);
        address vault = factory.createVault(
            VaultFactory.VaultConfig({token: BASE_USDC, rulebook: rulebook, beneficiary: makeAddr("heir")}), p
        );
        assertEq(IERC20(BASE_USDC).allowance(user, address(executor)), 500e6, "real USDC accepted our permit");

        vm.recordLogs();
        vm.prank(BASE_CALLBACK_PROXY);
        executor.split(rulebook, user, BASE_USDC, 20e6, 1);

        assertEq(IERC20(BASE_USDC).balanceOf(vault), 20e6);
        assertEq(IERC20(BASE_USDC).allowance(user, address(executor)), 480e6);

        // Safety invariant 6: the executor's pull must not look like the user's own signed activity. Real USDC's
        // transferFrom emits Transfer(user -> vault), which the Guardian ignores because `to` is the vault, and no
        // Approval, which the Guardian would otherwise count.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == BASE_USDC) {
                assertTrue(logs[i].topics[0] != APPROVAL_TOPIC, "transferFrom emitted Approval");
            }
        }
    }
}
