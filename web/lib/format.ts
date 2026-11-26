// Small, pure formatters shared by every card. Covered by tests/format.test.ts.

const THIN_SPACE = " ";

/** Shortens an address the Reactscan way: `0x038E06...F9bD6B82` (0x + 6, then the last 8). */
export function shortAddress(address: string): string {
  if (address.length <= 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

/**
 * Formats a raw token amount with a fixed number of decimals, rounding down so the page never
 * shows more than is there. Thousands are separated by a thin space, as DESIGN.md's stats are.
 * `formatAmount(20_000_000n, 6, "USDC")` → `"20.00 USDC"`.
 */
export function formatAmount(raw: bigint, decimals: number, symbol?: string, fractionDigits = 2): string {
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const shown = fractionDigits === 0 ? "" : fraction(value % base, decimals, fractionDigits);
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
  const text = `${negative ? "-" : ""}${wholeText}${shown}`;
  return symbol ? `${text} ${symbol}` : text;
}

/**
 * The whole part and the fraction of an amount, for stats that set the cents in a quieter colour.
 * `amountParts(145_500_000n, 6)` → `["145", ".50"]`.
 */
export function amountParts(raw: bigint, decimals: number, fractionDigits = 2): [string, string] {
  const text = formatAmount(raw, decimals, undefined, fractionDigits);
  const dot = text.indexOf(".");
  return dot === -1 ? [text, ""] : [text.slice(0, dot), text.slice(dot)];
}

function fraction(remainder: bigint, decimals: number, digits: number): string {
  const padded = remainder.toString().padStart(decimals, "0");
  return "." + (padded + "0".repeat(digits)).slice(0, digits);
}

/** Parses a decimal string typed by the user ("12.5") into raw units, or returns null if it is not a valid amount. */
export function parseAmount(text: string, decimals: number): bigint | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/**
 * A countdown in the mono style the Guardian card uses: `89d 04h`, `5h 07m`, `3m 09s`, or `now`.
 * Seconds are whole numbers; anything at or below zero reads `now`.
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  return `${minutes}m ${pad(secs)}s`;
}

/** "4 minutes ago", "2 days ago", "just now": for last-activity rows. */
export function formatAgo(seconds: number): string {
  if (seconds < 45) return "just now";
  const units: [number, string][] = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const n = Math.round(seconds / size);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "1 minute ago";
}

/** A duration in plain words for rule sentences: "90 days", "1 hour", "30 minutes". */
export function formatDuration(seconds: number): string {
  const units: [number, string][] = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  for (const [size, name] of units) {
    if (seconds >= size && seconds % size === 0) {
      const n = seconds / size;
      return `${n} ${name}${n === 1 ? "" : "s"}`;
    }
  }
  const days = seconds / 86_400;
  return `${days.toFixed(2)} days`;
}

/** Joins names the way a sentence does: "Base", "Base and Arbitrum", "A, B and C". */
export function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
