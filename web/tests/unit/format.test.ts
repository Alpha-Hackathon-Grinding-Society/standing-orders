import { describe, expect, it } from "vitest";
import {
  formatAgo,
  formatAmount,
  formatCountdown,
  formatDuration,
  joinWords,
  parseAmount,
  shortAddress,
} from "@/lib/format";

const T = " ";

describe("shortAddress (U-6: Reactscan style)", () => {
  it("keeps 0x + 6 and the last 8", () => {
    expect(shortAddress("0x038E06aB1f0f5a2C7d33E4A2bC64C0a5F9bD6B82")).toBe("0x038E06...F9bD6B82");
  });
  it("leaves short strings alone", () => {
    expect(shortAddress("0x1234")).toBe("0x1234");
  });
});

describe("formatAmount", () => {
  it("formats USDC with units", () => {
    expect(formatAmount(20_000_000n, 6, "USDC")).toBe("20.00 USDC");
  });
  it("rounds down, never up", () => {
    expect(formatAmount(19_999_999n, 6, "USDC")).toBe("19.99 USDC");
  });
  it("separates thousands with a thin space", () => {
    expect(formatAmount(1_234_567_890_000n, 6)).toBe(`1${T}234${T}567.89`);
  });
  it("handles zero and 18 decimals", () => {
    expect(formatAmount(0n, 6, "USDC")).toBe("0.00 USDC");
    expect(formatAmount(4_200_000_000_000_000_000n, 18, "REACT", 1)).toBe("4.2 REACT");
  });
  it("supports no decimals", () => {
    expect(formatAmount(25_000_000n, 6, undefined, 0)).toBe("25");
  });
});

describe("parseAmount", () => {
  it("parses whole and decimal amounts", () => {
    expect(parseAmount("25", 6)).toBe(25_000_000n);
    expect(parseAmount("12.5", 6)).toBe(12_500_000n);
    expect(parseAmount(" 0.000001 ", 6)).toBe(1n);
  });
  it("rejects bad input and too many decimals", () => {
    expect(parseAmount("", 6)).toBeNull();
    expect(parseAmount("-1", 6)).toBeNull();
    expect(parseAmount("1e6", 6)).toBeNull();
    expect(parseAmount("0.0000001", 6)).toBeNull();
  });
});

describe("formatCountdown (Guardian card)", () => {
  it("shows days and hours above a day", () => {
    expect(formatCountdown(89 * 86_400 + 4 * 3_600 + 59)).toBe("89d 04h");
  });
  it("shows hours and minutes below a day", () => {
    expect(formatCountdown(5 * 3_600 + 7 * 60)).toBe("5h 07m");
  });
  it("shows minutes and seconds below an hour", () => {
    expect(formatCountdown(189)).toBe("3m 09s");
  });
  it("reads now at or past zero", () => {
    expect(formatCountdown(0)).toBe("now");
    expect(formatCountdown(-5)).toBe("now");
  });
});

describe("formatAgo, formatDuration, joinWords", () => {
  it("formats ages", () => {
    expect(formatAgo(10)).toBe("just now");
    expect(formatAgo(240)).toBe("4 minutes ago");
    expect(formatAgo(3_600)).toBe("1 hour ago");
    expect(formatAgo(3 * 86_400)).toBe("3 days ago");
  });
  it("formats durations in plain words", () => {
    expect(formatDuration(90 * 86_400)).toBe("90 days");
    expect(formatDuration(3_600)).toBe("1 hour");
    expect(formatDuration(180)).toBe("3 minutes");
  });
  it("joins words like a sentence", () => {
    expect(joinWords(["Base"])).toBe("Base");
    expect(joinWords(["Base", "Arbitrum"])).toBe("Base and Arbitrum");
    expect(joinWords(["A", "B", "C"])).toBe("A, B and C");
  });
});
