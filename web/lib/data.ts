// Reads everything the dashboard shows straight from public RPCs: Base for the vault and executor,
// Reactive for the Rulebook. No backend. Preview fixtures (lib/preview.ts) return the same shape.
import { type Address, type PublicClient, createPublicClient, getAbiItem, http, zeroAddress } from "viem";
import { SYSTEM_CONTRACT, erc20Abi, executorAbi, factoryAbi, rulebookAbi, systemAbi, vaultAbi } from "./abi";
import type { GuardianState } from "./guardian";
import { type Network, type NetworkKey, NETWORKS } from "./networks";

export type RulebookInfo = {
  address: Address;
  state: GuardianState;
  warningSince: number;
  lastActiveAny: number;
  silencePeriod: number;
  gracePeriod: number;
  guardianCheckInterval: number;
  splitBps: number;
  periodCap: bigint;
  periodLength: number;
  splitThisPeriod: bigint;
  incomeSenders: Address[];
  vesting: Address;
  claimInterval: number;
  watchedChains: number[];
  lastActive: { chainId: number; at: number }[];
  balance: bigint;
  debt: bigint;
};

export type StewardData = {
  network: NetworkKey;
  user: Address;
  vault: Address | null;
  vaultBalance: bigint;
  beneficiary: Address | null;
  coldWallet: Address | null;
  /** USDC the executor may still move (what is left of the permit). */
  allowance: bigint;
  paused: boolean;
  /** The Rulebook as registered with the executor; null before setup or if Reactive could not be read. */
  rulebook: RulebookInfo | null;
  rulebookAddress: Address | null;
  /** Unix seconds when this was read. */
  now: number;
};

export type StewardHistory = {
  /** Sum of every Rule 1 split into the vault. */
  savedTotal: bigint;
  /** When the vault was registered with the executor (unix seconds), or null if not found. */
  since: number | null;
};

const clients = new Map<string, PublicClient>();

export function baseClient(network: Network, rpc = network.baseRpc): PublicClient {
  return cached(`${network.key}:base:${rpc}`, () =>
    createPublicClient({ chain: network.base, transport: http(rpc, { batch: true }) }),
  );
}

export function reactiveClient(network: Network): PublicClient {
  return cached(`${network.key}:reactive`, () =>
    createPublicClient({ chain: network.reactive, transport: http(network.reactiveRpc, { batch: true }) }),
  );
}

function cached(key: string, make: () => PublicClient): PublicClient {
  let client = clients.get(key);
  if (!client) {
    client = make();
    clients.set(key, client);
  }
  return client;
}

export async function loadSteward(key: NetworkKey, user: Address): Promise<StewardData> {
  const network = NETWORKS[key];
  const d = network.deployment;
  const now = Math.floor(Date.now() / 1000);
  const empty: StewardData = {
    network: key,
    user,
    vault: null,
    vaultBalance: 0n,
    beneficiary: null,
    coldWallet: null,
    allowance: 0n,
    paused: false,
    rulebook: null,
    rulebookAddress: null,
    now,
  };
  if (!d) return empty;

  const base = baseClient(network);
  const [vault, rulebookAddress, paused, allowance] = await base.multicall({
    allowFailure: false,
    contracts: [
      { address: d.vaultFactory, abi: factoryAbi, functionName: "vaultOf", args: [user] },
      { address: d.ordersExecutor, abi: executorAbi, functionName: "rulebookOf", args: [user] },
      { address: d.ordersExecutor, abi: executorAbi, functionName: "paused", args: [user] },
      { address: d.usdc, abi: erc20Abi, functionName: "allowance", args: [user, d.ordersExecutor] },
    ],
  });
  if (vault === zeroAddress) return { ...empty, paused, allowance };

  const [vaultBalance, beneficiary, coldWallet] = await base.multicall({
    allowFailure: false,
    contracts: [
      { address: d.usdc, abi: erc20Abi, functionName: "balanceOf", args: [vault] },
      { address: vault, abi: vaultAbi, functionName: "beneficiary" },
      { address: vault, abi: vaultAbi, functionName: "coldWallet" },
    ],
  });

  let rulebook: RulebookInfo | null = null;
  try {
    rulebook = await loadRulebook(network, rulebookAddress);
  } catch {
    rulebook = null; // Reactive unreachable: the vault still shows, the Guardian card says it could not read.
  }

  return {
    ...empty,
    vault,
    vaultBalance,
    beneficiary,
    coldWallet: coldWallet === zeroAddress ? null : coldWallet,
    allowance,
    paused,
    rulebook,
    rulebookAddress,
  };
}

export async function loadRulebook(network: Network, address: Address): Promise<RulebookInfo> {
  const client = reactiveClient(network);
  const read = (functionName: string, args?: readonly unknown[]) =>
    client.readContract({ address, abi: rulebookAbi, functionName, args } as never) as Promise<unknown>;

  const [
    state,
    warningSince,
    lastActiveAny,
    silencePeriod,
    gracePeriod,
    checkInterval,
    splitBps,
    periodCap,
    periodLength,
    splitThisPeriod,
    incomeSenders,
    vesting,
    claimInterval,
    watchedChains,
    balance,
    debt,
  ] = await Promise.all([
    read("state"),
    read("warningSince"),
    read("lastActiveAny"),
    read("silencePeriod"),
    read("gracePeriod"),
    read("guardianCheckInterval"),
    read("splitBps"),
    read("periodCap"),
    read("periodLength"),
    read("splitThisPeriod"),
    read("incomeSenders"),
    read("vesting"),
    read("claimInterval"),
    read("watchedChains"),
    client.getBalance({ address }),
    client.readContract({ address: SYSTEM_CONTRACT, abi: systemAbi, functionName: "debt", args: [address] }),
  ]);

  const chains = (watchedChains as bigint[]).map(Number);
  const lastActive = await Promise.all(
    chains.map(async (chainId) => ({
      chainId,
      at: Number((await read("lastActive", [BigInt(chainId)])) as bigint),
    })),
  );

  return {
    address,
    state: Number(state) as GuardianState,
    warningSince: Number(warningSince as bigint),
    lastActiveAny: Number(lastActiveAny as bigint),
    silencePeriod: Number(silencePeriod as bigint),
    gracePeriod: Number(gracePeriod as bigint),
    guardianCheckInterval: Number(checkInterval as bigint),
    splitBps: Number(splitBps as number),
    periodCap: periodCap as bigint,
    periodLength: Number(periodLength as bigint),
    splitThisPeriod: splitThisPeriod as bigint,
    incomeSenders: incomeSenders as Address[],
    vesting: vesting as Address,
    claimInterval: Number(claimInterval as bigint),
    watchedChains: chains,
    lastActive,
    balance,
    debt: debt as bigint,
  };
}

/**
 * Total saved by Rule 1 and the day the vault was registered, from the executor's events for this
 * user. Scans from the deployment block in chunks the logs RPC accepts.
 */
export async function loadHistory(key: NetworkKey, user: Address): Promise<StewardHistory> {
  const network = NETWORKS[key];
  const d = network.deployment;
  if (!d) return { savedTotal: 0n, since: null };
  const client = baseClient(network, network.logsRpc);
  const latest = await client.getBlockNumber();

  const ranges: [bigint, bigint][] = [];
  for (let from = BigInt(d.deployBlock); from <= latest; from += network.logsChunk) {
    const to = from + network.logsChunk - 1n;
    ranges.push([from, to > latest ? latest : to]);
  }

  const [registered, split] = [
    getAbiItem({ abi: executorAbi, name: "UserRegistered" }),
    getAbiItem({ abi: executorAbi, name: "SplitExecuted" }),
  ];
  const chunks = await mapLimit(ranges, 4, ([fromBlock, toBlock]) =>
    Promise.all([
      client.getLogs({ address: d.ordersExecutor, event: registered, args: { user }, fromBlock, toBlock }),
      client.getLogs({ address: d.ordersExecutor, event: split, args: { user }, fromBlock, toBlock }),
    ]),
  );

  let savedTotal = 0n;
  let registeredBlock: bigint | null = null;
  for (const [registrations, splits] of chunks) {
    for (const log of splits) savedTotal += log.args.amount ?? 0n;
    if (registeredBlock === null && registrations.length > 0) registeredBlock = registrations[0].blockNumber;
  }
  const since =
    registeredBlock === null ? null : Number((await client.getBlock({ blockNumber: registeredBlock })).timestamp);
  return { savedTotal, since };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
