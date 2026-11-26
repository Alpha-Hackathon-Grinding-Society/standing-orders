// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {console2} from "forge-std/Script.sol";
import {StewardScript} from "../StewardScript.sol";
import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";
import {Rulebook} from "../../src/Rulebook.sol";
import {ReactiveConstants} from "../../src/libraries/ReactiveConstants.sol";

// One script per user action (U-5). Base-side ones run against BASE_SEPOLIA_RPC / BASE_RPC, Reactive-side ones
// against LASNA_RPC / REACTIVE_RPC. Every Makefile `ops-*` target names the contract with --tc.

/// @notice "I'm alive" on Base: resets the Guardian's silence clock (and clears a Warning).
contract Alive is StewardScript {
    function run() external {
        vm.startBroadcast(_key());
        _heartbeat().alive();
        vm.stopBroadcast();
    }
}

/// @notice Stops every rule: the Rulebook sends no callbacks while paused. Withdrawals keep working.
contract Pause is StewardScript {
    function run() external {
        vm.startBroadcast(_key());
        _executor().pause();
        vm.stopBroadcast();
    }
}

/// @notice Resumes every rule.
contract Unpause is StewardScript {
    function run() external {
        vm.startBroadcast(_key());
        _executor().unpause();
        vm.stopBroadcast();
    }
}

/// @notice Withdraws from your vault to your wallet. Works any time, even while paused or in Warning.
/// @dev Env: WITHDRAW_TOKEN [USDC], WITHDRAW_AMOUNT [whole balance].
contract Withdraw is StewardScript {
    function run() external {
        uint256 key = _key();
        address token = vm.envOr("WITHDRAW_TOKEN", _usdc());
        address vault = address(_vault(vm.addr(key)));
        (, bytes memory ret) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", vault));
        uint256 amount = vm.envOr("WITHDRAW_AMOUNT", abi.decode(ret, (uint256)));
        vm.startBroadcast(key);
        _vault(vm.addr(key)).withdraw(token, amount);
        vm.stopBroadcast();
    }
}

/// @notice Proposes a new beneficiary. It takes effect only after 24 hours (then run ApplyBeneficiary).
/// @dev Env: BENEFICIARY.
contract ProposeBeneficiary is StewardScript {
    function run() external {
        uint256 key = _key();
        vm.startBroadcast(key);
        _vault(vm.addr(key)).proposeBeneficiary(vm.envAddress("BENEFICIARY"));
        vm.stopBroadcast();
    }
}

/// @notice Applies the proposed beneficiary, once 24 hours have passed.
contract ApplyBeneficiary is StewardScript {
    function run() external {
        uint256 key = _key();
        vm.startBroadcast(key);
        _vault(vm.addr(key)).applyBeneficiary();
        vm.stopBroadcast();
    }
}

/// @notice Proposes where Rule 2 claims go (address(0) = keep them in the vault). Applies after 24 hours.
/// @dev Env: COLD_WALLET.
contract ProposeColdWallet is StewardScript {
    function run() external {
        uint256 key = _key();
        vm.startBroadcast(key);
        _vault(vm.addr(key)).proposeColdWallet(vm.envAddress("COLD_WALLET"));
        vm.stopBroadcast();
    }
}

/// @notice Applies the proposed cold wallet, once 24 hours have passed.
contract ApplyColdWallet is StewardScript {
    function run() external {
        uint256 key = _key();
        vm.startBroadcast(key);
        _vault(vm.addr(key)).applyColdWallet();
        vm.stopBroadcast();
    }
}

/// @notice Changes Rule 1 on your Rulebook (Reactive): split share, per-period cap, income senders.
/// @dev Env: SPLIT_BPS, PERIOD_CAP, INCOME_SENDERS (comma-separated; unset = none).
contract EditRules is StewardScript {
    function run() external {
        uint256 key = _key();
        vm.startBroadcast(key);
        _rulebook()
            .editRules(
                uint16(vm.envUint("SPLIT_BPS")),
                vm.envUint("PERIOD_CAP"),
                vm.envOr("INCOME_SENDERS", ",", new address[](0))
            );
        vm.stopBroadcast();
    }
}

/// @notice Sends REACT (lREACT on Lasna) to your Rulebook and pays off any debt, so it keeps receiving events.
/// @dev Env: TOP_UP_WEI [1 ether].
contract TopUpReact is StewardScript {
    function run() external {
        uint256 key = _key();
        Rulebook rulebook = _rulebook();
        vm.startBroadcast(key);
        (bool ok,) = address(rulebook).call{value: vm.envOr("TOP_UP_WEI", uint256(1 ether))}("");
        require(ok, "top-up failed");
        rulebook.coverDebt();
        vm.stopBroadcast();
    }
}

/// @notice Sends REACT left in your Rulebook back to your wallet, after paying its debt. Use it once the Guardian has
///         released (the Rulebook has stopped), or to retire a test Rulebook.
/// @dev Env: WITHDRAW_REACT_WEI [everything left after debt]. RULEBOOK [yours, from deployments].
contract WithdrawReact is StewardScript {
    function run() external {
        Rulebook target = Rulebook(payable(vm.envOr("RULEBOOK", address(_rulebook()))));
        uint256 debt = ISystemContract(payable(ReactiveConstants.SYSTEM)).debt(address(target));
        uint256 left = address(target).balance > debt ? address(target).balance - debt : 0;
        uint256 amount = vm.envOr("WITHDRAW_REACT_WEI", left);
        vm.startBroadcast(_key());
        target.withdrawReact(amount);
        vm.stopBroadcast();
    }
}

/// @notice Advances the Guardian by timestamp if cron is late (G-5). Anyone may run it, for any Rulebook.
/// @dev Env: RULEBOOK [yours, from deployments].
contract CheckNow is StewardScript {
    function run() external {
        Rulebook target = Rulebook(payable(vm.envOr("RULEBOOK", address(_rulebook()))));
        vm.startBroadcast(_key());
        target.checkNow();
        vm.stopBroadcast();
    }
}

/// @notice Read-only: your Rulebook's Guardian state, clocks and REACT balance. Run against Reactive.
contract Status is StewardScript {
    function run() external view {
        Rulebook rb = _rulebook();
        string[3] memory names = ["Active", "Warning", "Released"];
        console2.log("Rulebook          ", address(rb));
        console2.log("Guardian state    ", names[uint256(rb.state())]);
        console2.log("now               ", block.timestamp);
        console2.log("last activity     ", rb.lastActiveAny());
        console2.log("warning since     ", rb.warningSince());
        console2.log("silence, grace    ", rb.silencePeriod(), rb.gracePeriod());
        console2.log("paused            ", rb.paused());
        console2.log("split this period ", rb.splitThisPeriod());
        console2.log("callback nonce    ", rb.nonce());
        console2.log("REACT balance     ", address(rb).balance);
        uint256[] memory chains = rb.watchedChains();
        for (uint256 i; i < chains.length; ++i) {
            console2.log("last active on chain", chains[i], rb.lastActive(chains[i]));
        }
    }
}
