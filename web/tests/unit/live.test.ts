// Reads the phone's real testnet vault through the same code the page uses. Needs the network, so
// it only runs when asked: LIVE=1 pnpm test
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { loadHistory, loadSteward } from "@/lib/data";

const PHONE = "0x810fCBF8A695Ffa0e4480207c667995139F33276" as Address;

describe.skipIf(!process.env.LIVE)("live testnet reads", () => {
  it("loads the phone's vault, Rulebook and Guardian state", async () => {
    const data = await loadSteward("testnet", PHONE);
    expect(data.vault).toBe("0x074DB6571aCB40D0d19E126C293A5cDC2754b8e9");
    expect(data.vaultBalance).toBeGreaterThanOrEqual(20_000_000n);
    expect(data.rulebook?.address).toBe("0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a");
    expect(data.rulebook?.splitBps).toBe(2_000);
    expect(data.rulebook?.watchedChains).toEqual([84_532, 1301]);
    console.log({ ...data, rulebook: { ...data.rulebook, incomeSenders: data.rulebook?.incomeSenders.length } });
  }, 60_000);

  it("finds the registration and the 20 USDC split in the executor's events", async () => {
    const history = await loadHistory("testnet", PHONE);
    expect(history.savedTotal).toBeGreaterThanOrEqual(20_000_000n);
    expect(history.since).not.toBeNull();
    console.log(history);
  }, 120_000);
});
