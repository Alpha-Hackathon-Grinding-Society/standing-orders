// The saving-days heatmap: one square per day, shaded by how many payments came in that day, GitHub style.
// Pure functions over unix seconds, so the grid, levels and streaks are tested without a browser or a clock.
import type { SourcedInflow } from "./data";

const DAY = 86_400;

export type Level = 0 | 1 | 2 | 3 | 4;

export type HeatDay = {
  /** Days since 1970-01-01 in the viewer's time zone: the day's identity. */
  index: number;
  /** "Thu, Nov 27", in the viewer's calendar. */
  label: string;
  /** Payments that came in that day, newest first. */
  items: SourcedInflow[];
  level: Level;
  /** Before the vault existed: not a day with nothing saved, just no vault yet. */
  beforeSetup: boolean;
  /** After today: the rest of the current week, drawn empty. */
  future: boolean;
};

export type SavingDays = {
  /** Columns of seven days, Sunday first, oldest week first. */
  weeks: HeatDay[][];
  /** Month names over the column where each month starts. */
  months: { column: number; label: string }[];
  /** Days in a row, ending today, with at least one payment. A quiet today doesn't break it yet. */
  streak: number;
  /** The longest run of such days. */
  best: number;
  /** Days with a payment, out of the days since setup (or since the first payment, if setup is unknown). */
  activeDays: number;
  trackedDays: number;
  /** The newest day with a payment, to show first. */
  latest: number | null;
};

/** The shade for a day: 0 none, then 1, 2, 3–4 and 5 or more payments. */
export function levelFor(count: number): Level {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * The day a moment falls on, in the viewer's time zone. `offsetMinutes` is `Date#getTimezoneOffset()`:
 * minutes to add to local time to reach UTC (−60 in West Africa, +300 in New York).
 */
export function dayIndex(at: number, offsetMinutes: number): number {
  return Math.floor((at - offsetMinutes * 60) / DAY);
}

const dateLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** A day index back to its calendar date, read as UTC so the viewer's own zone can't shift it again. */
const dateOf = (index: number) => new Date(index * DAY * 1000);

/** 1970-01-01 was a Thursday: day 0 is weekday 4 with Sunday as 0. */
const weekday = (index: number) => (((index + 4) % 7) + 7) % 7;

export function buildSavingDays(
  items: readonly SourcedInflow[],
  { now, weeks, offsetMinutes, since }: { now: number; weeks: number; offsetMinutes: number; since: number | null },
): SavingDays {
  const today = dayIndex(now, offsetMinutes);
  const byDay = new Map<number, SourcedInflow[]>();
  for (const item of items) {
    if (item.at <= 0) continue; // a payment whose block time could not be read has no day
    const index = dayIndex(item.at, offsetMinutes);
    byDay.set(index, [...(byDay.get(index) ?? []), item]);
  }
  const active = [...byDay.keys()].sort((a, b) => a - b);
  // Tracking starts at setup, or at the first payment if that came earlier (a listed sender can pay before
  // the vault exists): a day with a payment is never drawn as "before setup".
  const setupDay = since !== null ? dayIndex(since, offsetMinutes) : today;
  const firstDay = Math.min(setupDay, active[0] ?? setupDay);

  // The grid ends on the Saturday of this week and starts on the Sunday `weeks - 1` weeks before.
  const start = today - weekday(today) - (weeks - 1) * 7;
  const grid: HeatDay[][] = [];
  const months: SavingDays["months"] = [];
  for (let column = 0; column < weeks; column++) {
    const week: HeatDay[] = [];
    for (let row = 0; row < 7; row++) {
      const index = start + column * 7 + row;
      const dayItems = (byDay.get(index) ?? []).sort((a, b) => b.at - a.at);
      week.push({
        index,
        label: dateLabel.format(dateOf(index)),
        items: dayItems,
        level: levelFor(dayItems.length),
        beforeSetup: index < firstDay,
        future: index > today,
      });
    }
    // A month's label goes over the first column whose Sunday falls in it.
    const month = monthLabel.format(dateOf(week[0].index));
    if (column === 0 || month !== monthLabel.format(dateOf(week[0].index - 7))) months.push({ column, label: month });
    grid.push(week);
  }
  // The first column's month is dropped when the next month starts too close to fit both names.
  if (months.length > 1 && months[1].column < 3) months.shift();

  const has = (index: number) => byDay.has(index);
  let streak = 0;
  for (let index = has(today) ? today : today - 1; has(index); index--) streak++;

  let best = 0;
  let run = 0;
  for (let i = 0; i < active.length; i++) {
    run = i > 0 && active[i] === active[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const trackedDays = Math.max(0, today - firstDay + 1);
  const activeDays = active.filter((index) => index >= firstDay && index <= today).length;
  return { weeks: grid, months, streak, best, activeDays, trackedDays, latest: active.at(-1) ?? null };
}

/** "1 payment", "3 payments". */
export function paymentsText(count: number): string {
  return `${count} ${count === 1 ? "payment" : "payments"}`;
}

/** "1 day", "7 days". */
export function daysText(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}
