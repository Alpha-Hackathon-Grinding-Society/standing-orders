// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {VaultFactory} from "../../src/VaultFactory.sol";

/// @notice Second setup step on Base: signs the USDC permit for the executor and creates the caller's vault,
///         registering the Rulebook from deployments/rulebook-{lasna|reactive}.json.
/// @dev Env: BENEFICIARY (required), PERMIT_CAP [1000e6] = total USDC the executor may ever pull for Rule 1,
///      RULEBOOK_FILE [rulebook-lasna | rulebook-reactive] = the deployments/<name>.json DeployRulebook wrote.
///      Usage: forge script script/ops/CreateVault.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
contract CreateVault is Script {
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(key);
        bool mainnet = block.chainid == 8453;
        require(!mainnet || vm.envOr("STEWARD_MAINNET_APPROVED", false), "CreateVault: mainnet needs explicit approval");

        string memory base = vm.readFile(string.concat("deployments/", mainnet ? "base" : "base-sepolia", ".json"));
        string memory rbName = vm.envOr("RULEBOOK_FILE", string(mainnet ? "rulebook-reactive" : "rulebook-lasna"));
        string memory rb = vm.readFile(string.concat("deployments/", rbName, ".json"));
        VaultFactory factory = VaultFactory(vm.parseJsonAddress(base, ".vaultFactory"));
        address usdc = vm.parseJsonAddress(base, ".usdc");
        address rulebook = vm.parseJsonAddress(rb, ".rulebook");
        require(vm.parseJsonAddress(rb, ".user") == user, "CreateVault: Rulebook belongs to another wallet");
        require(vm.parseJsonAddress(rb, ".vault") == factory.predictVault(user), "CreateVault: Rulebook vault mismatch");

        uint256 cap = vm.envOr("PERMIT_CAP", uint256(1000e6));
        VaultFactory.Permit memory p = _signPermit(key, IERC20Permit(usdc), address(factory.executor()), cap);

        vm.startBroadcast(key);
        address vault = factory.createVault(
            VaultFactory.VaultConfig({token: usdc, rulebook: rulebook, beneficiary: vm.envAddress("BENEFICIARY")}), p
        );
        vm.stopBroadcast();

        console2.log("Vault   ", vault);
        console2.log("Rulebook", rulebook);
        console2.log("Allowance for the executor", cap);
    }

    function _signPermit(uint256 key, IERC20Permit token, address spender, uint256 value)
        internal
        view
        returns (VaultFactory.Permit memory p)
    {
        address owner = vm.addr(key);
        p.value = value;
        p.deadline = block.timestamp + 1 hours;
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, token.nonces(owner), p.deadline));
        (p.v, p.r, p.s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }
}
