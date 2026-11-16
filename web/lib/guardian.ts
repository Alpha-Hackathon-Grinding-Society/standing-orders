// Turns the Rulebook's Guardian fields into what the Guardian card shows. Pure, so it is unit tested
// (tests/guardian.test.ts) and the card only renders the result.
import { formatCountdown } from "./format";

/** Matches `Rulebook.GuardianState`: Active = 0, Warning = 1, Released = 2. */
export type GuardianState = 0 | 1 | 2;

export type GuardianInput = {
  state: GuardianState;
  /** Unix seconds. */
  now: number;
  lastActiveAny: number;
  warningSince: number;
  silencePeriod: number;
  gracePeriod: number;
  guardianCheckInterval: number;
  paused: boolean;
};

export type GuardianTone = "success" | "warning" | "quartz" | "muted";

export type GuardianView = {
  /** Symbol and word, e.g. `(v) ACTIVE`; colour is never the only signal. */
  symbol: string;
  word: string;
  tone: GuardianTone;
  /** Mono countdown line, e.g. `89d 04h until warning`. */
  countdown: string;
  /** One plain sentence under the countdown. */
  detail: string;
  /** Unix seconds of the next transition, or null when nothing is scheduled. */
  nextAt: number | null;
};

export function guardianView(g: GuardianInput): GuardianView {
  if (g.silencePeriod === 0) {
    return {
      symbol: "( )",
      word: "OFF",
      tone: "muted",
      countdown: "Guardian is off",
      detail: "Your savings stay in the vault however long you are away.",
      nextAt: null,
    };
  }

  if (g.state === 2) {
    return {
      symbol: "(v)",
      word: "RELEASED",
      tone: "quartz",
      countdown: "Savings sent to your beneficiary",
      detail: "The Guardian finished its cycle and stopped. Withdraw still works for anything left in the vault.",
      nextAt: null,
    };
  }

  if (g.state === 1) {
    const releaseAt = g.warningSince + g.gracePeriod;
    const left = releaseAt - g.now;
    if (g.paused) {
      return {
        symbol: "[!]",
        word: "WARNING",
        tone: "warning",
        countdown: left > 0 ? `${formatCountdown(left)} until release` : "release waiting",
        detail: "You are paused, so nothing is released until you unpause. Press I'm alive to clear the warning.",
        nextAt: releaseAt,
      };
    }
    return {
      symbol: "[!]",
      word: "WARNING",
      tone: "warning",
      countdown: left > 0 ? `${formatCountdown(left)} until release` : "release at the next check",
      detail:
        "You have been silent too long. Press I'm alive, or sign anything on a watched chain, to stay in control.",
      nextAt: releaseAt,
    };
  }

  const warningAt = g.lastActiveAny + g.silencePeriod;
  const left = warningAt - g.now;
  return {
    symbol: "(v)",
    word: "ACTIVE",
    tone: "success",
    countdown: left > 0 ? `${formatCountdown(left)} until warning` : "warning at the next check",
    detail: "Every signed action on a watched chain resets this clock.",
    nextAt: warningAt,
  };
}
