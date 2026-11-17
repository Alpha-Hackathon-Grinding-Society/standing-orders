"use client";

import type { StewardData, StewardHistory } from "@/lib/data";
import { formatAgo, shortAddress } from "@/lib/format";
import { NETWORKS, chainName, txUrl } from "@/lib/networks";
import { ExternalLink, Panel, StatusToken } from "./ui";

/**
 * The reactive loop as four stops, origin → Rulebook → executor → vault, with a Maya pulse running
 * along it while the loop is live. The pulse stops, with the reason beside it, when the user is
 * paused or the Rulebook is out of REACT: motion here means "this is running".
 */
export function LoopDiagram({
  data,
  history,
  now,
}: {
  data: StewardData;
  history: StewardHistory | undefined;
  now: number;
}) {
  const network = NETWORKS[data.network];
  const rb = data.rulebook;
  if (!rb || !data.vault) return null;

  const stalled = rb.debt > 0n ? "OUT OF REACT" : data.paused ? "PAUSED" : null;
  const last = history?.recent[0];
  const stops = [
    { label: "Origin", value: rb.watchedChains.map(chainName).join(" · "), note: "your transfers and heartbeats" },
    { label: "Rulebook", value: shortAddress(rb.address), note: `decides on ${network.reactive.name}` },
    { label: "Executor", value: network.base.name, note: "checks and carries it out" },
    { label: "Vault", value: shortAddress(data.vault), note: "where your savings land" },
  ];

  return (
    <Panel
      title="The loop"
      id="loop-title"
      right={
        stalled ? (
          <StatusToken
            symbol={stalled === "PAUSED" ? "[!]" : "(x)"}
            word={stalled}
            tone={stalled === "PAUSED" ? "warning" : "danger"}
          />
        ) : (
          <StatusToken symbol=">>" word="LIVE" tone="info" />
        )
      }
    >
      <ol className={`loop flex flex-col md:flex-row ${stalled ? "loop-stalled" : ""}`}>
        {stops.map((stop, i) => (
          <li key={stop.label} className="flex flex-col md:flex-1 md:flex-row md:items-center">
            {i > 0 ? (
              <span aria-hidden="true" className="loop-wire" style={{ "--i": i - 1 } as React.CSSProperties} />
            ) : null}
            <div
              className="loop-stop flex flex-col gap-1 rounded-md border border-hairline bg-surface-raised px-3 py-2 md:flex-1"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="font-mono text-sm uppercase text-ink-muted">
                {"// "}
                {stop.label}
              </span>
              <span className="font-mono text-sm text-ink">{stop.value}</span>
              <span className="text-sm text-ink-muted">{stop.note}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="font-mono text-sm text-ink-muted">
        {last ? (
          <>
            Last callback {last.at > 0 ? formatAgo(now - last.at) : "at an unknown time"} |{" "}
            <span className="text-sm">
              <ExternalLink href={txUrl(network.baseExplorer, last.hash)}>{shortAddress(last.hash)}</ExternalLink>
            </span>
          </>
        ) : history ? (
          "Waiting for the first event. Income from a listed sender starts the loop."
        ) : (
          "Reading the executor's events..."
        )}
      </p>
    </Panel>
  );
}
