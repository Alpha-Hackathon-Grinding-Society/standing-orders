// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AbstractPayer} from "@reactive/src/base/AbstractPayer.sol";
import {AbstractCallback} from "@reactive/src/base/AbstractCallback.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {HelloReceiver} from "../../src/hello/HelloReceiver.sol";
import {MockCallbackProxy} from "../mocks/MockCallbackProxy.sol";

contract HelloReceiverTest is Test {
    MockCallbackProxy internal proxy;
    HelloReceiver internal receiver;

    address internal helloReactive = makeAddr("helloReactive");
    address internal alice = makeAddr("alice");

    function setUp() public {
        proxy = new MockCallbackProxy();
        receiver = new HelloReceiver{value: 1 ether}(IPayable(payable(address(proxy))), helloReactive);
    }

    function _pingPayload(address from, uint256 value) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(HelloReceiver.ping.selector, address(0), from, value);
    }

    function test_pingFromProxyWithRightSenderIsStored() public {
        vm.expectEmit(address(receiver));
        emit HelloReceiver.Pinged(helloReactive, alice, 100e6, 1);
        proxy.deliver(address(receiver), helloReactive, _pingPayload(alice, 100e6));

        assertEq(receiver.pingCount(), 1);
        assertEq(receiver.lastRvmId(), helloReactive);
        assertEq(receiver.lastFrom(), alice);
        assertEq(receiver.lastValue(), 100e6);
    }

    function test_rejectsCallerThatIsNotTheProxy() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, alice, address(proxy)));
        receiver.ping(helloReactive, alice, 1);
    }

    function test_rejectsWrongReactVmId() public {
        address impostor = makeAddr("impostor");
        vm.expectRevert(
            abi.encodeWithSelector(AbstractCallback.CallbackNotAuthorized.selector, impostor, helloReactive)
        );
        proxy.deliver(address(receiver), impostor, _pingPayload(alice, 1));
        assertEq(receiver.pingCount(), 0);
    }

    function test_rejectsDeployerWalletAsReactVmId() public {
        // In Omni the injected sender is the reactive contract, never the wallet that deployed it (NOTES section 6).
        vm.expectRevert(
            abi.encodeWithSelector(AbstractCallback.CallbackNotAuthorized.selector, address(this), helloReactive)
        );
        proxy.deliver(address(receiver), address(this), _pingPayload(alice, 1));
    }

    function test_coverDebtPaysTheProxy() public {
        proxy.setDebt(address(receiver), 0.01 ether);
        receiver.coverDebt();
        assertEq(address(proxy).balance, 0.01 ether);
        assertEq(address(receiver).balance, 0.99 ether);
    }

    function test_onlyProxyCanPullPayment() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, alice, address(proxy)));
        receiver.pay(1);

        vm.prank(address(proxy));
        receiver.pay(0.5 ether);
        assertEq(address(proxy).balance, 0.5 ether);
    }
}
