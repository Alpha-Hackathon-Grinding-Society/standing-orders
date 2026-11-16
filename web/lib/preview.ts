// Labelled sample data for `?preview=<state>`: lets anyone (and the Playwright smoke test) see every
// Guardian state without a wallet. The page always shows a PREVIEW banner when this is in use.
import type { Address } from "viem";
import type { StewardData, StewardHistory } from "./data";

export const PREVIEW_STATES = ["active", "warning", "released", "paused", "lowreact", "novault"] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

export function isPreviewState(value: string | null): value is PreviewState {
  return value !== null && (PREVIEW_STATES as readonly string[]).includes(value);
}

const USER = "0x810fCBF8A695Ffa0e4480207c667995139F33276" as Address;
const DAY = 86_400;
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
      incomeSenders: ["0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502"],
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
  if (state === "novault") return { savedTotal: 0n, since: null };
  return { savedTotal: 145_500_000n, since: now - 41 * DAY };
}
