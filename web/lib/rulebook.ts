// Builds the Rulebook the user deploys from their own wallet: the same Config and defaults as
// contracts/script/DeployRulebook.s.sol `_config`, encoded onto the compiled bytecode.
import { type Address, type Hex, encodeDeployData, zeroAddress } from "viem";
import { rulebookAbi } from "./abi";
import generated from "./generated/contracts.json";
import type { Network } from "./networks";

export type RulebookConfig = {
  chainId: bigint;
  token: Address;
  executor: Address;
  vault: Address;
  heartbeat: Address;
  splitBps: number;
  periodCap: bigint;
  periodLength: bigint;
  incomeSenders: Address[];
  vesting: Address;
  vestingToken: Address;
  claimInterval: bigint;
  watchedChains: bigint[];
  silencePeriod: bigint;
  gracePeriod: bigint;
  guardianCheckInterval: bigint;
  cronTopic: bigint;
};

/** What the setup form collects, already parsed and validated (see lib/setup.ts). */
export type RuleChoices = {
  splitBps: number;
  periodCap: bigint;
  periodDays: number;
  incomeSenders: Address[];
  claim: { vesting: Address; vestingToken: Address; intervalHours: number } | null;
  guardian: { silenceDays: number; graceDays: number } | null;
};

const DAY = 86_400;
const GUARDIAN_CHECK_INTERVAL = 3_600n; // 1 hour, as on mainnet

export function rulebookConfig(network: Network, vault: Address, choices: RuleChoices): RulebookConfig {
  const d = network.deployment;
  if (!d) throw new Error(`Steward is not deployed on ${network.label.toLowerCase()} yet.`);
  return {
    chainId: BigInt(d.chainId),
    token: d.usdc,
    executor: d.ordersExecutor,
    vault,
    heartbeat: d.heartbeat,
    splitBps: choices.splitBps,
    periodCap: choices.periodCap,
    periodLength: BigInt(Math.round(choices.periodDays * DAY)),
    incomeSenders: choices.incomeSenders,
    vesting: choices.claim?.vesting ?? zeroAddress,
    vestingToken: choices.claim?.vestingToken ?? zeroAddress,
    claimInterval: BigInt(Math.round((choices.claim?.intervalHours ?? 24) * 3_600)),
    watchedChains: network.watchedChains.map(BigInt),
    silencePeriod: choices.guardian ? BigInt(Math.round(choices.guardian.silenceDays * DAY)) : 0n,
    gracePeriod: choices.guardian ? BigInt(Math.round(choices.guardian.graceDays * DAY)) : 0n,
    guardianCheckInterval: GUARDIAN_CHECK_INTERVAL,
    cronTopic: network.cronTopic,
  };
}

/** The deploy transaction's data: Rulebook creation code followed by the ABI-encoded config. */
export function rulebookDeployData(config: RulebookConfig): Hex {
  return encodeDeployData({
    abi: rulebookAbi,
    bytecode: generated.rulebookBytecode as Hex,
    args: [config],
  });
}
