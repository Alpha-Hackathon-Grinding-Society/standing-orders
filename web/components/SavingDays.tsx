"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { MoneySources, Source } from "@/lib/data";
import { formatAmount, shortAddress } from "@/lib/format";
import { type NetworkKey, NETWORKS, txUrl } from "@/lib/networks";
import { type HeatDay, type Level, buildSavingDays, daysText, paymentsText } from "@/lib/savingDays";
import { ExternalLink, Notice, Panel, Spinner } from "./ui";

/** Square and gap in px (`size-3.5`, `gap-1`): as many weeks as fit the card, from two months to a year. */
const CELL = 14;
const GAP = 4;
const MIN_WEEKS = 8;
const MAX_WEEKS = 53;
/** Payments listed under the picked day; the rest are counted. */
const LISTED = 4;

/** Empty days use the heatmap-cell surface; busier days take Maya at rising strength (DESIGN.md: Info / live).
 *  The faintest shade still reaches 3:1 against the panel, so a day with one payment is never colour-faint. */
const SHADE: Record<Level, string> = {
  0: "bg-surface-raised",
  1: "bg-maya/50",
  2: "bg-maya/65",
  3: "bg-maya/80",
  4: "bg-maya",
};

const SOURCE: Record<Source, string> = { income: "income", vesting: "claim", deposits: "deposit" };

/**
 * `// SAVING DAYS`: one square per day, shaded by how many payments came into the vault's orbit that day
 * (income Steward splits, vesting claims, deposits), with the current and best streak. Pick a day, by
 * pointer or with the arrow keys, to see its payments.
 */
export function SavingDays({
  network,
  sources,
  failed,
  since,
  now,
}: {
  network: NetworkKey;
  sources: MoneySources | undefined;
  failed: boolean;
  /** When the vault was set up, if known: days before it are drawn apart from quiet days. */
  since: number | null | undefined;
  now: number;
}) {
  const n = NETWORKS[network];
  // The grid shows as many weeks as fit the card's width, measured once it renders and on every resize.
  const [weeks, setWeeks] = useState(26);
  const frame = useRef<HTMLDivElement>(null);
  const ready = sources !== undefined && !failed;
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () =>
      setWeeks(Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.floor((el.clientWidth + GAP) / (CELL + GAP)))));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);
  // Recomputed each hour or when new payments arrive, not on every tick of `now`.
  const hour = Math.floor(now / 3_600);
  const days = useMemo(
    () =>
      sources
        ? buildSavingDays(sources.all, {
            now: hour * 3_600,
            weeks,
            offsetMinutes: new Date().getTimezoneOffset(),
            since: since ?? null,
          })
        : null,
    [sources, hour, since, weeks],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  if (failed) {
    return (
      <Panel title="Saving days" id="days-title">
        <Notice tone="danger" symbol="(x)" word="FAILED">
          Could not read your payments on {n.base.name}; reload the page to try again.
        </Notice>
      </Panel>
    );
  }
  if (!days) {
    return (
      <Panel title="Saving days" id="days-title">
        <Spinner caption={`Reading your payments on ${n.base.name}`} />
      </Panel>
    );
  }

  const all = days.weeks.flat();
  const pickable = (day: HeatDay) => !day.future && !day.beforeSetup;
  const todayDay = all.filter((day) => !day.future).at(-1)!;
  const selectedIndex = picked ?? days.latest ?? todayDay.index;
  const selected = all.find((day) => day.index === selectedIndex) ?? todayDay;

  const move = (event: KeyboardEvent, from: HeatDay) => {
    const step: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    let target: HeatDay | undefined;
    if (event.key in step) target = all.find((day) => day.index === from.index + step[event.key]);
    else if (event.key === "Home") target = all.find(pickable);
    else if (event.key === "End") target = todayDay;
    else return;
    event.preventDefault();
    if (!target || !pickable(target)) return;
    setPicked(target.index);
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${target.index}"]`)?.focus();
  };

  return (
    <Panel title="Saving days" id="days-title" right={`last ${weeks} weeks`}>
      <div ref={frame} className="w-full overflow-hidden">
        <div
          ref={grid}
          role="group"
          aria-label="Saving days: one square per day, brighter when more payments came in. Use the arrow keys to move between days."
          className="flex gap-1"
        >
          {days.weeks.map((week, column) => {
            const month = days.months.find((m) => m.column === column);
            return (
              <div key={week[0].index} className="flex flex-col gap-1">
                {/* The month's name hangs over the columns to its right, so every column stays one square wide. */}
                <span aria-hidden="true" className="relative h-5">
                  {month ? (
                    <span className="absolute top-0 left-0 whitespace-nowrap font-mono text-sm text-ink-muted">
                      {month.label}
                    </span>
                  ) : null}
                </span>
                {week.map((day) =>
                  pickable(day) ? (
                    <button
                      key={day.index}
                      type="button"
                      data-day={day.index}
                      tabIndex={day.index === selected.index ? 0 : -1}
                      aria-pressed={day.index === selected.index}
                      aria-label={`${day.label}: ${day.items.length > 0 ? paymentsText(day.items.length) : "nothing came in"}`}
                      onClick={() => setPicked(day.index)}
                      onKeyDown={(event) => move(event, day)}
                      className={`size-3.5 cursor-pointer rounded-sm ${SHADE[day.level]} ${
                        day.index === selected.index ? "ring-2 ring-ink" : ""
                      }`}
                    />
                  ) : (
                    <span
                      key={day.index}
                      aria-hidden="true"
                      className={`size-3.5 rounded-sm ${day.future ? "" : "bg-surface-raised/40"}`}
                    />
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-mono text-sm text-ink-default">
          {selected.label} · {selected.items.length > 0 ? paymentsText(selected.items.length) : "nothing came in"}
        </p>
        {selected.items.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {selected.items.slice(0, LISTED).map((item) => (
              <li key={item.id} className="font-mono text-sm text-ink-muted">
                {SOURCE[item.source]} {formatAmount(item.amount, item.decimals, item.symbol)} ·{" "}
                <ExternalLink href={txUrl(n.baseExplorer, item.hash)}>{shortAddress(item.hash)}</ExternalLink>
              </li>
            ))}
            {selected.items.length > LISTED ? (
              <li className="font-mono text-sm text-ink-muted">and {selected.items.length - LISTED} more</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-sm">
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div className="flex gap-2">
            <dt className="uppercase text-ink-muted">Streak</dt>
            <dd className="text-ink">{daysText(days.streak)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="uppercase text-ink-muted">Best</dt>
            <dd className="text-ink">{daysText(days.best)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="uppercase text-ink-muted">Days with money in</dt>
            <dd className="text-ink">
              {days.activeDays} of {days.trackedDays}
            </dd>
          </div>
        </dl>
        <p aria-hidden="true" className="flex items-center gap-1 text-ink-muted">
          less
          {([0, 1, 2, 3, 4] as Level[]).map((level) => (
            <span key={level} className={`size-3.5 rounded-sm ${SHADE[level]}`} />
          ))}
          more
        </p>
      </div>
    </Panel>
  );
}
