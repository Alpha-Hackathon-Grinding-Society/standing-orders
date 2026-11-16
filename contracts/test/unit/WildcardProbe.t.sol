// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {WildcardProbe} from "../../src/hello/WildcardProbe.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";
import {MockSystem} from "../mocks/MockSystem.sol";
import {LogRecords} from "../helpers/LogRecords.sol";

contract WildcardProbeTest is Test {
    uint256 internal constant BASE_SEPOLIA = 84_532;
    uint256 internal constant IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;

    MockSystem internal sys;
    WildcardProbe internal probe;
    address internal user = makeAddr("user");

    function setUp() public {
        vm.etch(ReactiveConstants.SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(payable(ReactiveConstants.SYSTEM));
        probe = new WildcardProbe(BASE_SEPOLIA, user);
    }

    function test_subscribesToAnyContractFilteredOnUser() public view {
        assertEq(sys.subscriptionCount(), 2);
        uint256[2] memory topics = [LogRecords.TRANSFER_TOPIC, uint256(keccak256("Approval(address,address,uint256)"))];
        for (uint256 i; i < 2; ++i) {
            MockSystem.Subscription memory s = sys.subscriptionAt(i);
            assertEq(s.chainId, BASE_SEPOLIA);
            assertEq(s.contractAddress, address(0), "contract wildcard");
            assertEq(s.topic0, topics[i]);
            assertEq(s.topic1, uint256(uint160(user)), "filtered on the user");
            assertEq(s.topic2, IGNORE);
            assertEq(s.topic3, IGNORE);
        }
    }

    function test_reactRecordsTheMatchedLog() public {
        address token = makeAddr("anyToken");
        vm.expectEmit(address(probe));
        emit WildcardProbe.ActivitySeen(0xabc, token, LogRecords.TRANSFER_TOPIC);
        vm.prank(ReactiveConstants.SYSTEM);
        probe.react(LogRecords.transfer(BASE_SEPOLIA, token, user, address(1), 5, 0xabc));
        assertEq(probe.seenCount(), 1);
    }

    function test_reactIsSystemOnly() public {
        vm.expectRevert();
        probe.react(LogRecords.transfer(BASE_SEPOLIA, address(1), user, address(1), 5, 0xabc));
    }

    function test_coverDebtPaysTheSystemContract() public {
        vm.deal(address(probe), 1 ether);
        sys.setDebt(address(probe), 0.1 ether);
        probe.coverDebt();
        assertEq(address(probe).balance, 0.9 ether);
    }
}
