// Labelled sample data for `?preview=<state>`: lets anyone (and the Playwright smoke test) see every
// Guardian state without a wallet. The page always shows a PREVIEW banner when this is in use.
import type { Address } from "viem";
import type { Inflow, MoneySources, PaymentDetails, RecentAction, StewardData, StewardHistory } from "./data";

export const PREVIEW_STATES = ["active", "warning", "released", "paused", "lowreact", "novault"] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

export function isPreviewState(value: string | null): value is PreviewState {
  return value !== null && (PREVIEW_STATES as readonly string[]).includes(value);
}

const USER = "0x810fCBF8A695Ffa0e4480207c667995139F33276" as Address;
const DAY = 86_400;
/** Two listed income senders, say an employer and a client. */
const SENDERS = [
  "0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502",
  "0x7A2bC94e10D2c5fE8B1a3E5d0c9F42A6b7E1D3c8",
] as Address[];
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
const REACT = 10n ** 18n;

/** Sample data for one state, read at `now` (unix seconds). */
export function previewData(state: PreviewState, now: number): StewardData {
  const base: StewardData = {
    network: "testnet",
    user: USER,
    vault: "0x074DB6571aCB40D0d19E126C293A5cDC2754b8e9",
    vaultBalance: 145_500_000n,
    beneficiary: "0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502",
    coldWallet: null,
    allowance: 54_500_000n,
    paused: state === "paused",
    rulebookAddress: "0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a",
    now,
    rulebook: {
      address: "0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a",
      state: 0,
      warningSince: 0,
      lastActiveAny: now - 3 * DAY,
      silencePeriod: 90 * DAY,
      gracePeriod: 14 * DAY,
      guardianCheckInterval: 3_600,
      splitBps: 2_000,
      periodCap: 25_000_000n,
      periodLength: 30 * DAY,
      splitThisPeriod: 20_000_000n,
      incomeSenders: [SENDERS[0], SENDERS[1]],
      vesting: "0x0000000000000000000000000000000000000000",
      claimInterval: DAY,
      watchedChains: [84_532, 1301],
      lastActive: [
        { chainId: 84_532, at: now - 3 * DAY },
        { chainId: 1301, at: now - 12 * DAY },
      ],
      balance: 11n * REACT,
      debt: 0n,
    },
  };
  const rb = base.rulebook!;

  switch (state) {
    case "active":
    case "paused":
      return base;
    case "warning":
      return {
        ...base,
        rulebook: {
          ...rb,
          state: 1,
          lastActiveAny: now - 92 * DAY,
          warningSince: now - 2 * DAY,
          lastActive: [
            { chainId: 84_532, at: now - 92 * DAY },
            { chainId: 1301, at: now - 120 * DAY },
          ],
        },
      };
    case "released":
      return {
        ...base,
        vaultBalance: 0n,
        rulebook: {
          ...rb,
          state: 2,
          lastActiveAny: now - 110 * DAY,
          warningSince: now - 18 * DAY,
          balance: 2n * REACT,
        },
      };
    case "lowreact":
      return { ...base, rulebook: { ...rb, balance: REACT / 5n } };
    case "novault":
      return {
        ...base,
        vault: null,
        vaultBalance: 0n,
        beneficiary: null,
        allowance: 0n,
        rulebook: null,
        rulebookAddress: null,
      };
  }
}

export function previewHistory(state: PreviewState, now: number): StewardHistory {
  if (state === "novault") return { savedTotal: 0n, since: null, recent: [] };
  const action = (kind: RecentAction["kind"], amount: bigint | null, daysAgo: number, byte: string): RecentAction => ({
    kind,
    amount,
    hash: `0x${byte.repeat(32)}`,
    at: now - daysAgo * DAY,
  });
  const recent = [
    action("split", 20_000_000n, 2, "a1"),
    action("split", 25_000_000n, 32, "b2"),
    action("split", 25_000_000n, 36, "c3"),
  ];
  if (state === "released") recent.unshift(action("release", null, 4, "d4"));
  return { savedTotal: 145_500_000n, since: now - 41 * DAY, recent };
}

/**
 * Sample payments for the money map: monthly-ish income from the two listed senders, and three deposits
 * by hand in different tokens. Claim and secure is off in this sample, so vesting is empty.
 */
export function previewSources(state: PreviewState, now: number): MoneySources {
  if (state === "novault") return { income: [], vesting: [], deposits: [] };
  const inflow = (
    i: number,
    from: Address,
    token: Address,
    symbol: string,
    decimals: number,
    amount: bigint,
    daysAgo: number,
  ): Inflow => {
    const hash = `0x${(i + 16).toString(16).padStart(2, "0").repeat(32)}` as const;
    // Base Sepolia makes a block every 2 seconds; the sample's head is block 34,000,000.
    const block = PREVIEW_HEAD - Math.round((daysAgo * DAY) / 2);
    const logIndex = (i * 7) % 23;
    return {
      id: `${hash}:${logIndex}`,
      from,
      token,
      symbol,
      decimals,
      amount,
      hash,
      block,
      logIndex,
      at: now - daysAgo * DAY,
    };
  };
  const usdc = (whole: number) => BigInt(whole) * 1_000_000n;
  const income = [
    [100, 2],
    [250, 9],
    [80, 16],
    [125, 23],
    [300, 32],
    [125, 36],
    [100, 44],
    [250, 51],
    [90, 58],
    [125, 65],
    [100, 72],
    [250, 79],
  ].map(([amount, days], i) => inflow(i, SENDERS[i % 2], USDC, "USDC", 6, usdc(amount), days));
  const deposits = [
    inflow(20, USER, "0x4200000000000000000000000000000000000006", "WETH", 18, 50_000_000_000_000_000n, 6),
    inflow(21, USER, "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", "cbBTC", 8, 200_000n, 20),
    inflow(22, USER, USDC, "USDC", 6, usdc(50), 40),
  ];
  return { income, vesting: [], deposits };
}

const PREVIEW_HEAD = 34_000_000;

/**
 * Sample transaction details for a preview payment, so the payment panel can be seen without a
 * wallet. Derived from the payment, so each one reads differently and the same one reads the same.
 */
export function previewPaymentDetails(item: Inflow): PaymentDetails {
  const seed = item.logIndex + 1;
  return {
    status: "success",
    confirmations: BigInt(PREVIEW_HEAD - item.block + 1),
    signer: item.from,
    contract: item.token,
    nonce: 40 + seed,
    gasUsed: BigInt(51_000 + seed * 137),
    fee: BigInt(2_100_000_000 + seed * 13_000_000) * 1_000n,
  };
}
