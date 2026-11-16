// The setup form: its fields as typed, validation into RuleChoices, and the plain-English review.
// Pure, so tests/setup.test.ts covers every rule.
import { type Address, getAddress, isAddress, parseEther } from "viem";
import { formatAmount, formatDuration, joinWords, parseAmount, shortAddress } from "./format";
import { chainName, type Network } from "./networks";
import type { RuleChoices } from "./rulebook";

export type SetupForm = {
  splitPercent: string;
  incomeSenders: string;
  periodCap: string;
  periodDays: string;
  budget: string;
  claimOn: boolean;
  vesting: string;
  vestingToken: string;
  claimHours: string;
  guardianOn: boolean;
  silenceDays: string;
  graceDays: string;
  beneficiary: string;
  funding: string;
};

export type SetupField = Exclude<keyof SetupForm, "claimOn" | "guardianOn">;

export type SetupPlan = {
  choices: RuleChoices;
  /** Total USDC the executor may ever move (the permit value). */
  budget: bigint;
  beneficiary: Address;
  /** REACT sent with the Rulebook deploy, in wei. */
  funding: bigint;
};

export type Validation = { errors: Partial<Record<SetupField, string>>; plan: SetupPlan | null };

export const USDC_DECIMALS = 6;

export function defaultForm(network: Network): SetupForm {
  return {
    splitPercent: "20",
    incomeSenders: "",
    periodCap: "25",
    periodDays: "30",
    budget: "100",
    claimOn: false,
    vesting: "",
    vestingToken: "",
    claimHours: "24",
    guardianOn: true,
    silenceDays: "90",
    graceDays: "14",
    beneficiary: "",
    funding: network.defaultFunding,
  };
}

function number(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function addresses(text: string): Address[] | null {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!parts.every((p) => isAddress(p))) return null;
  return [...new Set(parts.map((p) => getAddress(p)))];
}

export function validateSetup(form: SetupForm, user?: Address): Validation {
  const errors: Validation["errors"] = {};

  const percent = number(form.splitPercent);
  if (percent === null || percent < 1 || percent > 50 || !Number.isInteger(percent * 100)) {
    errors.splitPercent = "Enter a share from 1 to 50 percent.";
  }

  const senders = addresses(form.incomeSenders);
  if (senders === null) errors.incomeSenders = "Use full 0x addresses, separated by commas or new lines.";
  else if (senders.length === 0) errors.incomeSenders = "Add at least one address that pays you USDC.";
  else if (user && senders.includes(getAddress(user))) {
    errors.incomeSenders = "List the addresses that pay you, not your own wallet.";
  }

  const cap = parseAmount(form.periodCap, USDC_DECIMALS);
  if (cap === null || cap === 0n) errors.periodCap = "Enter the most to save per period, in USDC (for example 25).";

  const periodDays = number(form.periodDays);
  if (periodDays === null || periodDays <= 0) errors.periodDays = "Enter a period length in days (for example 30).";

  const budget = parseAmount(form.budget, USDC_DECIMALS);
  if (budget === null || budget === 0n) errors.budget = "Enter the total USDC Steward may ever move (for example 100).";
  else if (cap !== null && budget < cap) errors.budget = "Make the total at least one period's cap.";

  let claim: RuleChoices["claim"] = null;
  if (form.claimOn) {
    if (!isAddress(form.vesting.trim())) errors.vesting = "Enter your vesting contract's 0x address.";
    if (!isAddress(form.vestingToken.trim())) errors.vestingToken = "Enter the 0x address of the token that vests.";
    const hours = number(form.claimHours);
    if (hours === null || hours <= 0) errors.claimHours = "Enter how often to check, in hours (for example 24).";
    if (!errors.vesting && !errors.vestingToken && !errors.claimHours) {
      claim = {
        vesting: getAddress(form.vesting.trim()),
        vestingToken: getAddress(form.vestingToken.trim()),
        intervalHours: hours as number,
      };
    }
  }

  let guardian: RuleChoices["guardian"] = null;
  if (form.guardianOn) {
    const silence = number(form.silenceDays);
    const grace = number(form.graceDays);
    if (silence === null || silence <= 0) errors.silenceDays = "Enter how many silent days start a warning.";
    if (grace === null || grace <= 0) errors.graceDays = "Enter how many days to wait after the warning.";
    if (silence !== null && grace !== null && silence > 0 && grace > 0)
      guardian = { silenceDays: silence, graceDays: grace };
  }

  const beneficiary = form.beneficiary.trim();
  if (!isAddress(beneficiary)) errors.beneficiary = "Enter the 0x address that should receive your savings.";

  let funding = 0n;
  try {
    funding = parseEther(form.funding.trim() as `${number}`);
    if (funding <= 0n) errors.funding = "Send some REACT so your Rulebook can run.";
  } catch {
    errors.funding = "Enter an amount of REACT, for example 15.";
  }

  if (Object.keys(errors).length > 0) return { errors, plan: null };

  return {
    errors,
    plan: {
      choices: {
        splitBps: Math.round((percent as number) * 100),
        periodCap: cap as bigint,
        periodDays: periodDays as number,
        incomeSenders: senders as Address[],
        claim,
        guardian,
      },
      budget: budget as bigint,
      beneficiary: getAddress(beneficiary),
      funding,
    },
  };
}

/** The `// REVIEW` panel: one plain sentence per rule, then what the signatures allow. */
export function reviewLines(plan: SetupPlan, network: Network): string[] {
  const { choices } = plan;
  const usdc = (raw: bigint) => formatAmount(raw, USDC_DECIMALS, "USDC");
  const senders = joinWords(choices.incomeSenders.map(shortAddress));
  const lines = [
    `Pay yourself first: save ${choices.splitBps / 100}% of every USDC payment from ${senders}, ` +
      `at most ${usdc(choices.periodCap)} every ${formatDuration(Math.round(choices.periodDays * 86_400))}.`,
  ];
  lines.push(
    choices.claim
      ? `Claim and secure: every ${formatDuration(Math.round(choices.claim.intervalHours * 3_600))}, claim what has vested in ` +
          `${shortAddress(choices.claim.vesting)} and move it into your vault.`
      : "Claim and secure: off.",
  );
  lines.push(
    choices.guardian
      ? `Guardian: if you are silent for ${formatDuration(Math.round(choices.guardian.silenceDays * 86_400))} on ` +
          `${joinWords(network.watchedChains.map(chainName))}, warn you, wait ` +
          `${formatDuration(Math.round(choices.guardian.graceDays * 86_400))}, then send your savings to ${shortAddress(plan.beneficiary)}.`
      : `Guardian: off. Your beneficiary is still recorded as ${shortAddress(plan.beneficiary)}.`,
  );
  lines.push(
    `Limits: Steward may move at most ${usdc(plan.budget)} in total, only into your vault. ` +
      `Your Rulebook gets ${formatAmount(plan.funding, 18, network.reactive.nativeCurrency.symbol, 2)} to run.`,
  );
  return lines;
}
