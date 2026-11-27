import { describe, expect, it } from "vitest";
import type { SourcedInflow } from "@/lib/data";
import { buildSavingDays, dayIndex, daysText, levelFor, paymentsText } from "@/lib/savingDays";

const DAY = 86_400;
// Friday 2026-11-27, 12:00 UTC.
const NOW = Date.UTC(2026, 10, 27, 12) / 1000;
const WAT = -60; // West Africa Time, UTC+1, as Date#getTimezoneOffset reports it

function pay(at: number, source: SourcedInflow["source"] = "income"): SourcedInflow {
  return {
    id: `${at}:0`,
    from: "0x69Dfdc4f7B27Bbc167C43f7B86A94b318dFA32c9",
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
    amount: 100_000n,
    hash: `0x${"ab".repeat(32)}`,
    block: 1,
    logIndex: 0,
    at,
    source,
  };
}

const build = (items: SourcedInflow[], since: number | null = null, weeks = 4) =>
  buildSavingDays(items, { now: NOW, weeks, offsetMinutes: WAT, since });

describe("levelFor", () => {
  it("shades by how many payments came in: none, 1, 2, 3–4, 5 or more", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(levelFor)).toEqual([0, 1, 2, 3, 3, 4, 4]);
  });
});

describe("dayIndex", () => {
  it("puts a payment on the viewer's own calendar day", () => {
    const lateEvening = Date.UTC(2026, 10, 26, 23, 30) / 1000; // 00:30 on the 27th in WAT
    expect(dayIndex(lateEvening, 0)).toBe(dayIndex(NOW, 0) - 1);
    expect(dayIndex(lateEvening, WAT)).toBe(dayIndex(NOW, WAT));
  });
});

describe("buildSavingDays", () => {
  it("draws whole weeks, Sunday first, ending with this week", () => {
    const days = build([]);
    expect(days.weeks).toHaveLength(4);
    expect(days.weeks.every((week) => week.length === 7)).toBe(true);
    expect(days.weeks[0][0].label).toBe("Sun, Nov 1");
    expect(days.weeks[3][5].label).toBe("Fri, Nov 27");
    expect(days.weeks[3][5].future).toBe(false);
    expect(days.weeks[3][6].future).toBe(true); // Saturday is still to come
  });

  it("counts every payment on its day and shades the day by the count", () => {
    const days = build([pay(NOW - 60), pay(NOW - 120, "deposits"), pay(NOW - DAY)]);
    const today = days.weeks[3][5];
    expect(today.items).toHaveLength(2);
    expect(today.level).toBe(2);
    expect(days.weeks[3][4].level).toBe(1);
    expect(days.weeks[3][3].level).toBe(0);
  });

  it("marks days before setup apart from days with nothing saved", () => {
    const setup = NOW - 2 * DAY;
    const days = build([pay(NOW)], setup);
    expect(days.weeks[3][2].beforeSetup).toBe(true); // Tuesday, before the vault
    expect(days.weeks[3][3].beforeSetup).toBe(false); // Wednesday, setup day
    expect(days.trackedDays).toBe(3);
    expect(days.activeDays).toBe(1);
  });

  it("counts the streak back from today, and a quiet today doesn't break it yet", () => {
    const threeDays = [pay(NOW - DAY), pay(NOW - 2 * DAY), pay(NOW - 3 * DAY)];
    expect(build(threeDays).streak).toBe(3);
    expect(build([pay(NOW), ...threeDays]).streak).toBe(4);
    expect(build([pay(NOW - 2 * DAY)]).streak).toBe(0); // yesterday was quiet: the run is over
  });

  it("finds the best run anywhere in the history", () => {
    const old = [10, 11, 12, 13, 14].map((d) => pay(NOW - d * DAY));
    const days = build([...old, pay(NOW)]);
    expect(days.best).toBe(5);
    expect(days.streak).toBe(1);
  });

  it("never draws a day with a payment as before setup", () => {
    const days = build([pay(NOW - 5 * DAY)], NOW - DAY);
    const paid = days.weeks.flat().find((day) => day.items.length > 0)!;
    expect(paid.beforeSetup).toBe(false);
    expect(days.trackedDays).toBe(6);
  });

  it("drops the first month's name when the next month starts too close to fit both", () => {
    // 5 weeks back from Nov 27 starts on Sun, Oct 25: October has one column before November.
    expect(build([], null, 5).months.map((m) => m.label)).toEqual(["Nov"]);
  });

  it("labels a month over the first week that starts in it", () => {
    const days = build([], null, 8);
    expect(days.months.map((m) => m.label)).toEqual(["Oct", "Nov"]);
    expect(days.weeks[days.months[1].column][0].label).toMatch(/^Sun, Nov /);
  });

  it("skips payments whose time could not be read", () => {
    const days = build([pay(0), pay(NOW)]);
    expect(days.activeDays).toBe(1);
    expect(days.latest).toBe(dayIndex(NOW, WAT));
  });
});

describe("words", () => {
  it("says one or many", () => {
    expect(paymentsText(1)).toBe("1 payment");
    expect(paymentsText(3)).toBe("3 payments");
    expect(daysText(1)).toBe("1 day");
    expect(daysText(7)).toBe("7 days");
  });
});
