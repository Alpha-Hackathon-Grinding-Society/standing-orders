"use client";

import type { ReactNode } from "react";
import type { StewardData, StewardHistory } from "@/lib/data";
import { amountParts, formatAmount, formatDuration } from "@/lib/format";
import { USDC_DECIMALS } from "@/lib/setup";
import { Odometer } from "./motion/Odometer";

const DAY = 86_400;

/** The 4-up stat row (DESIGN.md, Stat tile): mono label at 50%, Inter 30 value, one quiet line under it. 2×2 on phones. */
export function StatRow({ data, history }: { data: StewardData; history: StewardHistory | undefined }) {
  const rb = data.rulebook;
  const days = history?.since ? Math.max(0, Math.floor((data.now - history.since) / DAY)) : null;

  return (
    <section aria-label="Summary">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile
          label="Saved automatically"
          value={history ? <Usdc raw={history.savedTotal} /> : null}
          note={history ? (history.savedTotal > 0n ? "from Pay yourself first" : "no splits yet") : null}
        />
        <Tile
          label="This period"
          value={rb ? <Usdc raw={rb.splitThisPeriod} /> : null}
          note={
            rb
              ? `of ${formatAmount(rb.periodCap, USDC_DECIMALS, "USDC")} every ${formatDuration(rb.periodLength)}`
              : null
          }
        />
        <Tile label="Budget left" value={<Usdc raw={data.allowance} />} note="what your signed permit still allows" />
        <Tile
          label="Running"
          value={days !== null ? `${days} day${days === 1 ? "" : "s"}` : null}
          note={
            history?.since
              ? `since ${new Date(history.since * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
              : null
          }
        />
      </dl>
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <dt className="font-mono text-sm uppercase text-ink-muted">
        {"// "}
        {label}
      </dt>
      <dd className="text-2xl font-normal tabular-nums text-ink md:text-3xl">
        {value ?? (
          <span className="shimmer block h-[1lh] w-24 rounded-sm">
            <span className="sr-only">Reading</span>
          </span>
        )}
      </dd>
      <dd className="text-sm text-ink-muted">{note ?? "reading..."}</dd>
    </div>
  );
}

/** A USDC amount with its cents at 50% and the unit in mono, as the vault balance writes it. */
function Usdc({ raw }: { raw: bigint }) {
  const [whole, cents] = amountParts(raw, USDC_DECIMALS);
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span>
        <Odometer text={whole} />
        <span className="text-ink-muted">
          <Odometer text={cents} />
        </span>
      </span>
      <span className="font-mono text-sm text-ink-mono">USDC</span>
    </span>
  );
}
