// The slices of Steward's contract ABIs the page calls, written as human-readable signatures
// copied from contracts/src. Keep them in step with the Solidity.
import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "function vaultOf(address owner) view returns (address)",
  "function predictVault(address owner) view returns (address)",
  "function createVault((address token, address rulebook, address beneficiary) config, (uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permit) returns (address)",
]);

export const executorAbi = parseAbi([
  "function rulebookOf(address user) view returns (address)",
  "function paused(address user) view returns (bool)",
  "function pause()",
  "function unpause()",
  "event UserRegistered(address indexed user, address indexed vault, address indexed rulebook, address token)",
  "event SplitExecuted(address indexed user, address indexed vault, uint256 amount, uint256 nonce)",
  "event ClaimExecuted(address indexed user, address indexed vesting, address indexed token, uint256 amount, bool toColdWallet, uint256 nonce)",
  "event VaultReleased(address indexed user, address indexed vault, uint256 nonce)",
]);

export const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function beneficiary() view returns (address)",
  "function coldWallet() view returns (address)",
  "function withdraw(address token, uint256 amount)",
  "event Deposited(address indexed owner, address indexed token, uint256 amount)",
]);

export const heartbeatAbi = parseAbi(["function alive()"]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function version() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
  "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
]);

export const rulebookAbi = parseAbi([
  "constructor((uint256 chainId, address token, address executor, address vault, address heartbeat, uint16 splitBps, uint256 periodCap, uint256 periodLength, address[] incomeSenders, address vesting, address vestingToken, uint256 claimInterval, uint256[] watchedChains, uint256 silencePeriod, uint256 gracePeriod, uint256 guardianCheckInterval, uint256 cronTopic) config) payable",
  "function owner() view returns (address)",
  "function splitBps() view returns (uint16)",
  "function periodCap() view returns (uint256)",
  "function periodLength() view returns (uint256)",
  "function splitThisPeriod() view returns (uint256)",
  "function incomeSenders() view returns (address[])",
  "function vesting() view returns (address)",
  "function vestingToken() view returns (address)",
  "function claimInterval() view returns (uint256)",
  "function silencePeriod() view returns (uint256)",
  "function gracePeriod() view returns (uint256)",
  "function guardianCheckInterval() view returns (uint256)",
  "function state() view returns (uint8)",
  "function warningSince() view returns (uint256)",
  "function lastActiveAny() view returns (uint256)",
  "function lastActive(uint256 chainId) view returns (uint256)",
  "function watchedChains() view returns (uint256[])",
  "function paused() view returns (bool)",
]);

/** Reactive's system contract (`ISystemContract.debt`), same address on Lasna and mainnet. */
export const SYSTEM_CONTRACT = "0x8888888888888888888888888888888888888888" as const;
export const systemAbi = parseAbi(["function debt(address) view returns (uint256)"]);
