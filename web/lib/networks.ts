// The two ways to run Steward: testnet (Base Sepolia + Lasna) and mainnet (Base + Reactive).
// Shared Base addresses come from contracts/deployments via `pnpm sync`; a testnet origin only
// ever pairs with a testnet destination.
import { type Address, type Chain, defineChain } from "viem";
import { base, baseSepolia, reactiveTestnet } from "viem/chains";
import generated from "./generated/contracts.json";

export const reactiveMainnet = defineChain({
  id: 1597,
  name: "Reactive Mainnet",
  nativeCurrency: { decimals: 18, name: "React", symbol: "REACT" },
  rpcUrls: { default: { http: ["https://mainnet-rpc.rnk.dev/"] } },
  blockExplorers: { default: { name: "Reactscan", url: "https://reactscan.net" } },
});

export const lasna = reactiveTestnet;

export type NetworkKey = "testnet" | "mainnet";

export type Deployment = {
  chainId: number;
  deployBlock: number;
  heartbeat: Address;
  ordersExecutor: Address;
  usdc: Address;
  vaultFactory: Address;
};

/**
 * Reactive cron topic for every Rulebook the page deploys (`ReactiveConstants.CRON1000`): one tick per
 * 1,000 blocks, about 18 minutes on Lasna and 13 on mainnet, so idle Rulebooks spend about 1 REACT a day.
 * Short demo timers use the e2e scripts (Cron10) instead.
 */
export const CRON1000 = 0xe20b31294d84c3661ddc8f423abb9c70310d0cf172aa2714ead78029b325e3f4n;

export type Network = {
  key: NetworkKey;
  label: string;
  base: Chain;
  reactive: Chain;
  /** RPC for reads on Base; `logsRpc` allows wide eth_getLogs ranges (50,000 blocks). */
  baseRpc: string;
  logsRpc: string;
  logsChunk: bigint;
  reactiveRpc: string;
  baseExplorer: string;
  reactiveExplorer: string;
  deployment: Deployment | null;
  /** Second watched chain for the Guardian, next to Base. */
  watchedChains: number[];
  cronTopic: bigint;
  /** REACT sent with the Rulebook deploy, as a decimal string. */
  defaultFunding: string;
  /** Below this the page shows `[!] LOW REACT` (about three days of idle cron ticks). */
  lowReact: bigint;
  /** Approximate REACT a Rulebook spends per day while idle, for the runway line. */
  reactPerDay: bigint;
};

const ether = 10n ** 18n;

export const NETWORKS: Record<NetworkKey, Network> = {
  testnet: {
    key: "testnet",
    label: "Testnet",
    base: baseSepolia,
    reactive: lasna,
    baseRpc: "https://sepolia.base.org",
    logsRpc: "https://base-sepolia-rpc.publicnode.com",
    logsChunk: 50_000n,
    reactiveRpc: "https://lasna-rpc.rnk.dev/",
    baseExplorer: "https://sepolia.basescan.org",
    reactiveExplorer: "https://lasna.reactscan.net",
    deployment: generated.deployments.testnet as Deployment | null,
    watchedChains: [84_532, 1301],
    cronTopic: CRON1000,
    defaultFunding: "0.5",
    lowReact: ether,
    reactPerDay: ether,
  },
  mainnet: {
    key: "mainnet",
    label: "Mainnet",
    base,
    reactive: reactiveMainnet,
    baseRpc: "https://mainnet.base.org",
    logsRpc: "https://base-rpc.publicnode.com",
    logsChunk: 50_000n,
    reactiveRpc: "https://mainnet-rpc.rnk.dev/",
    baseExplorer: "https://basescan.org",
    reactiveExplorer: "https://reactscan.net",
    deployment: generated.deployments.mainnet as Deployment | null,
    watchedChains: [8453, 42_161],
    cronTopic: CRON1000,
    defaultFunding: "15",
    lowReact: 4n * ether,
    reactPerDay: (13n * ether) / 10n,
  },
};

const CHAIN_NAMES: Record<number, string> = {
  8453: "Base",
  42_161: "Arbitrum",
  84_532: "Base Sepolia",
  1301: "Unichain Sepolia",
};

export function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `chain ${id}`;
}

export function txUrl(explorer: string, hash: string): string {
  return `${explorer}/tx/${hash}`;
}

export function addressUrl(explorer: string, address: string): string {
  return `${explorer}/address/${address}`;
}
