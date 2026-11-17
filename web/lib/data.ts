// Reads everything the dashboard shows straight from public RPCs: Base for the vault and executor,
// Reactive for the Rulebook. No backend. Preview fixtures (lib/preview.ts) return the same shape.
import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  formatLog,
  getAbiItem,
  http,
  numberToHex,
  pad,
  parseEventLogs,
  toEventSelector,
  zeroAddress,
} from "viem";
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

/** One action the Rulebook carried out on Base, read from the executor's events. */
export type RecentAction = {
  kind: "split" | "claim" | "release";
  /** USDC moved, or null when the amount is not in USDC (a vesting token) or not one number (a release). */
  amount: bigint | null;
  /** The callback transaction on Base. */
  hash: Hex;
  /** Unix seconds of the block it landed in. */
  at: number;
};

export type StewardHistory = {
  /** Sum of every Rule 1 split into the vault. */
  savedTotal: bigint;
  /** When the vault was registered with the executor (unix seconds), or null if not found. */
  since: number | null;
  /** The latest automatic actions, newest first, at most RECENT_LIMIT. */
  recent: RecentAction[];
};

export const RECENT_LIMIT = 5;
const HISTORY_EVENTS = ["UserRegistered", "SplitExecuted", "ClaimExecuted", "VaultReleased"] as const;

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
 * Total saved by Rule 1, the day the vault was registered and the latest automatic actions, from the
 * executor's events for this user. Every event here has the user as its first indexed topic, so one
 * eth_getLogs per chunk (OR of the four event signatures, AND the user) reads them all. Scans from the
 * deployment block in chunks the logs RPC accepts.
 */
export async function loadHistory(key: NetworkKey, user: Address): Promise<StewardHistory> {
  const network = NETWORKS[key];
  const d = network.deployment;
  if (!d) return { savedTotal: 0n, since: null, recent: [] };
  const client = baseClient(network, network.logsRpc);
  const latest = await client.getBlockNumber();

  const ranges: [bigint, bigint][] = [];
  for (let from = BigInt(d.deployBlock); from <= latest; from += network.logsChunk) {
    const to = from + network.logsChunk - 1n;
    ranges.push([from, to > latest ? latest : to]);
  }

  const topics = [HISTORY_EVENTS.map((name) => toEventSelector(getAbiItem({ abi: executorAbi, name }))), pad(user)];
  const chunks = await mapLimit(ranges, 4, async ([fromBlock, toBlock]) => {
    const raw = await client.request({
      method: "eth_getLogs",
      params: [{ address: d.ordersExecutor, topics, fromBlock: numberToHex(fromBlock), toBlock: numberToHex(toBlock) }],
    });
    return parseEventLogs({ abi: executorAbi, logs: raw.map((log) => formatLog(log)) });
  });
  const logs = chunks.flat();

  let savedTotal = 0n;
  let registeredBlock: bigint | null = null;
  const actions: (Omit<RecentAction, "at"> & { block: bigint })[] = [];
  for (const log of logs) {
    const block = log.blockNumber ?? 0n;
    const hash = log.transactionHash as Hex;
    switch (log.eventName) {
      case "UserRegistered":
        if (registeredBlock === null) registeredBlock = block;
        break;
      case "SplitExecuted":
        savedTotal += log.args.amount;
        actions.push({ kind: "split", amount: log.args.amount, hash, block });
        break;
      case "ClaimExecuted": {
        const inUsdc = log.args.token.toLowerCase() === d.usdc.toLowerCase();
        actions.push({ kind: "claim", amount: inUsdc ? log.args.amount : null, hash, block });
        break;
      }
      case "VaultReleased":
        actions.push({ kind: "release", amount: null, hash, block });
        break;
    }
  }

  const latestActions = actions
    .sort((a, b) => (a.block === b.block ? 0 : a.block > b.block ? -1 : 1))
    .slice(0, RECENT_LIMIT);
  const blocks = [
    ...new Set([...latestActions.map((a) => a.block), ...(registeredBlock === null ? [] : [registeredBlock])]),
  ];
  const times = new Map(
    await Promise.all(
      blocks.map(
        async (blockNumber) => [blockNumber, Number((await client.getBlock({ blockNumber })).timestamp)] as const,
      ),
    ),
  );
  return {
    savedTotal,
    since: registeredBlock === null ? null : (times.get(registeredBlock) ?? null),
    recent: latestActions.map(({ block, ...action }) => ({ ...action, at: times.get(block) ?? 0 })),
  };
}

/** One payment into the vault's orbit: income to the user, a vesting claim, or a deposit by hand. */
export type Inflow = {
  /** Unique per payment: transaction hash and log index. */
  id: string;
  /** Who paid: a listed income sender, the vesting contract, or the user for a deposit. */
  from: Address;
  token: Address;
  symbol: string;
  decimals: number;
  amount: bigint;
  hash: Hex;
  /** Unix seconds of the block, or 0 if it could not be read. */
  at: number;
};

/** Where the vault's money comes from, newest first in each list (the money map). */
export type MoneySources = {
  /** USDC sent to the user by a listed income sender: what Pay yourself first saves a share of. */
  income: Inflow[];
  /** Vested tokens the executor claimed (Claim and secure). */
  vesting: Inflow[];
  /** Tokens the owner deposited into the vault by hand. */
  deposits: Inflow[];
};

/** Payments kept per source; older ones are counted out of the map. */
export const SOURCE_LIMIT = 40;

/**
 * The money map's payments, read from three kinds of logs per chunk: USDC `Transfer` from any listed
 * sender to the user, the executor's `ClaimExecuted` for the user, and the vault's `Deposited`. Every
 * filter names the user as an indexed topic. Token symbols and decimals are read once per token.
 */
export async function loadSources(
  key: NetworkKey,
  user: Address,
  vault: Address,
  senders: readonly Address[],
): Promise<MoneySources> {
  const network = NETWORKS[key];
  const d = network.deployment;
  if (!d) return { income: [], vesting: [], deposits: [] };
  const client = baseClient(network, network.logsRpc);
  const latest = await client.getBlockNumber();

  const ranges: [bigint, bigint][] = [];
  for (let from = BigInt(d.deployBlock); from <= latest; from += network.logsChunk) {
    const to = from + network.logsChunk - 1n;
    ranges.push([from, to > latest ? latest : to]);
  }

  const filters = [
    ...(senders.length > 0
      ? [
          {
            address: d.usdc,
            topics: [toEventSelector("Transfer(address,address,uint256)"), senders.map((s) => pad(s)), pad(user)],
          },
        ]
      : []),
    {
      address: d.ordersExecutor,
      topics: [toEventSelector("ClaimExecuted(address,address,address,uint256,bool,uint256)"), pad(user)],
    },
    { address: vault, topics: [toEventSelector("Deposited(address,address,uint256)"), pad(user)] },
  ];
  const abi = [...erc20Abi, ...executorAbi, ...vaultAbi];

  const chunks = await mapLimit(ranges, 4, async ([fromBlock, toBlock]) => {
    const raw = await Promise.all(
      filters.map((filter) =>
        client.request({
          method: "eth_getLogs",
          params: [{ ...filter, fromBlock: numberToHex(fromBlock), toBlock: numberToHex(toBlock) }],
        }),
      ),
    );
    return parseEventLogs({ abi, logs: raw.flat().map((log) => formatLog(log)) });
  });

  type Raw = Omit<Inflow, "symbol" | "decimals" | "at"> & { block: bigint; index: number };
  const lists: Record<keyof MoneySources, Raw[]> = { income: [], vesting: [], deposits: [] };
  for (const log of chunks.flat()) {
    const hash = log.transactionHash as Hex;
    const base = { id: `${hash}:${log.logIndex}`, hash, block: log.blockNumber ?? 0n, index: log.logIndex ?? 0 };
    if (log.eventName === "Transfer") {
      lists.income.push({ ...base, from: log.args.from, token: d.usdc, amount: log.args.value });
    } else if (log.eventName === "ClaimExecuted") {
      lists.vesting.push({ ...base, from: log.args.vesting, token: log.args.token, amount: log.args.amount });
    } else if (log.eventName === "Deposited") {
      lists.deposits.push({ ...base, from: user, token: log.args.token, amount: log.args.amount });
    }
  }
  const newestFirst = (a: Raw, b: Raw) => (a.block === b.block ? b.index - a.index : a.block > b.block ? -1 : 1);
  for (const k of Object.keys(lists) as (keyof MoneySources)[]) {
    lists[k] = lists[k].sort(newestFirst).slice(0, SOURCE_LIMIT);
  }
  const all = [...lists.income, ...lists.vesting, ...lists.deposits];

  const tokens = [...new Set(all.map((item) => item.token.toLowerCase() as Address))];
  // Token reads go to the main RPC, which serves multicall; the logs RPC is only for wide log ranges.
  const meta = await baseClient(network).multicall({
    allowFailure: true,
    contracts: tokens.flatMap((address) => [
      { address, abi: erc20Abi, functionName: "symbol" } as const,
      { address, abi: erc20Abi, functionName: "decimals" } as const,
    ]),
  });
  const tokenInfo = new Map(
    tokens.map((address, i) => {
      const symbol = meta[i * 2];
      const decimals = meta[i * 2 + 1];
      return [
        address,
        {
          symbol: symbol.status === "success" ? String(symbol.result) : "TOKEN",
          decimals: decimals.status === "success" ? Number(decimals.result) : 18,
        },
      ] as const;
    }),
  );

  const blocks = [...new Set(all.map((item) => item.block))];
  const times = new Map(
    await mapLimit(blocks, 8, async (blockNumber) => {
      try {
        return [blockNumber, Number((await client.getBlock({ blockNumber })).timestamp)] as const;
      } catch {
        return [blockNumber, 0] as const; // the payment still shows, without its age
      }
    }),
  );

  const finish = (items: Raw[]): Inflow[] =>
    items.map(({ id, from, token, amount, hash, block }) => ({
      id,
      from,
      token,
      amount,
      hash,
      ...tokenInfo.get(token.toLowerCase() as Address)!,
      at: times.get(block) ?? 0,
    }));
  return { income: finish(lists.income), vesting: finish(lists.vesting), deposits: finish(lists.deposits) };
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
