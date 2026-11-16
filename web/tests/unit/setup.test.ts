import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import generated from "@/lib/generated/contracts.json";
import { NETWORKS } from "@/lib/networks";
import { rulebookConfig, rulebookDeployData } from "@/lib/rulebook";
import { type SetupForm, defaultForm, reviewLines, validateSetup } from "@/lib/setup";

const testnet = NETWORKS.testnet;
const PHONE = "0x810fCBF8A695Ffa0e4480207c667995139F33276" as Address;
const PC = "0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502";
const good: SetupForm = { ...defaultForm(testnet), incomeSenders: PC, beneficiary: PHONE };

describe("validateSetup (U-1 setup form)", () => {
  it("accepts the default rules with a sender and a beneficiary", () => {
    const { errors, plan } = validateSetup(good, PHONE);
    expect(errors).toEqual({});
    expect(plan?.choices.splitBps).toBe(2_000);
    expect(plan?.choices.periodCap).toBe(25_000_000n);
    expect(plan?.budget).toBe(100_000_000n);
    expect(plan?.funding).toBe(500_000_000_000_000_000n);
  });

  it("keeps the share between 1% and 50% (S-3)", () => {
    expect(validateSetup({ ...good, splitPercent: "0.5" }).errors.splitPercent).toBeDefined();
    expect(validateSetup({ ...good, splitPercent: "51" }).errors.splitPercent).toBeDefined();
    expect(validateSetup({ ...good, splitPercent: "12.5" }).plan?.choices.splitBps).toBe(1_250);
  });

  it("needs at least one valid income sender, and never the user's own wallet (S-1)", () => {
    expect(validateSetup({ ...good, incomeSenders: "" }).errors.incomeSenders).toBeDefined();
    expect(validateSetup({ ...good, incomeSenders: "0x123" }).errors.incomeSenders).toBeDefined();
    expect(validateSetup({ ...good, incomeSenders: PHONE }, PHONE).errors.incomeSenders).toBeDefined();
    const two = validateSetup({
      ...good,
      incomeSenders: `${PC},\n${PC.toLowerCase()} 0x12E627587Ef1d653014AE6ABf9759DB2Ee5C1F2a`,
    });
    expect(two.plan?.choices.incomeSenders).toHaveLength(2);
  });

  it("needs a budget of at least one period's cap", () => {
    expect(validateSetup({ ...good, budget: "10" }).errors.budget).toBeDefined();
  });

  it("requires vesting addresses only when Claim and secure is on (C-1)", () => {
    expect(validateSetup({ ...good, claimOn: true }).errors.vesting).toBeDefined();
    const on = validateSetup({ ...good, claimOn: true, vesting: PC, vestingToken: PC, claimHours: "6" });
    expect(on.plan?.choices.claim?.intervalHours).toBe(6);
  });

  it("turns the Guardian off cleanly (G-2)", () => {
    const off = validateSetup({ ...good, guardianOn: false, silenceDays: "" });
    expect(off.errors).toEqual({});
    expect(off.plan?.choices.guardian).toBeNull();
  });

  it("requires a beneficiary and some REACT", () => {
    expect(validateSetup({ ...good, beneficiary: "" }).errors.beneficiary).toBeDefined();
    expect(validateSetup({ ...good, funding: "0" }).errors.funding).toBeDefined();
    expect(validateSetup({ ...good, funding: "abc" }).errors.funding).toBeDefined();
  });

  it("reviews every rule in plain English", () => {
    const lines = reviewLines(validateSetup(good).plan!, testnet);
    expect(lines[0]).toBe(
      "Pay yourself first: save 20% of every USDC payment from 0x1501D3...9Cfb0502, at most 25.00 USDC every 30 days.",
    );
    expect(lines[1]).toBe("Claim and secure: off.");
    expect(lines[2]).toContain("silent for 90 days on Base Sepolia and Unichain Sepolia");
    expect(lines[3]).toContain("at most 100.00 USDC in total");
  });
});

describe("rulebookDeployData (U-1: the page deploys what the script deploys)", () => {
  // The phone's testnet Rulebook was deployed by SetupPage.s.sol. Its recorded initcode is the compiled bytecode
  // of that day followed by the ABI-encoded Config. The bytecode moves on as the contract does; the settings the page
  // encodes must still match the script's byte for byte.
  it("encodes the same constructor settings as SetupPage.s.sol did for the phone's testnet Rulebook", () => {
    const file = join(__dirname, "..", "..", "..", "contracts", "deployments", "setup-base-sepolia.json");
    const script = JSON.parse(readFileSync(file, "utf8")) as { rulebookInitcode: string; vault: Address };
    const { plan } = validateSetup({ ...good, claimOn: false, guardianOn: true });
    const data = rulebookDeployData(rulebookConfig(testnet, script.vault, plan!.choices)).toLowerCase();
    const args = data.slice(generated.rulebookBytecode.length);
    expect(args.length).toBeGreaterThan(0);
    expect(script.rulebookInitcode.toLowerCase().endsWith(args)).toBe(true);
  });

  it("deploys the current compiled Rulebook", () => {
    const out = join(__dirname, "..", "..", "..", "contracts", "out", "Rulebook.sol", "Rulebook.json");
    const data = rulebookDeployData(rulebookConfig(testnet, PHONE, validateSetup(good).plan!.choices));
    expect(data.toLowerCase().startsWith(generated.rulebookBytecode.toLowerCase())).toBe(true);
    if (existsSync(out)) {
      const compiled = JSON.parse(readFileSync(out, "utf8")) as { bytecode: { object: string } };
      expect(generated.rulebookBytecode.toLowerCase()).toBe(compiled.bytecode.object.toLowerCase());
    }
  });
});
