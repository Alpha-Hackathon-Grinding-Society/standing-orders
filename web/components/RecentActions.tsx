"use client";

import type { RecentAction, StewardData, StewardHistory } from "@/lib/data";
import { formatAgo, formatAmount, shortAddress } from "@/lib/format";
import { NETWORKS, txUrl } from "@/lib/networks";
import { USDC_DECIMALS } from "@/lib/setup";
import { ExternalLink, Panel, Spinner } from "./ui";

const RULE: Record<RecentAction["kind"], string> = {
  split: "Pay yourself first",
  claim: "Claim and secure",
  release: "Guardian",
};

/** The latest callbacks the Rulebook sent, as a DESIGN.md data list: hash line, then `when | rule`, amount on the right. */
export function RecentActions({
  data,
  history,
  now,
}: {
  data: StewardData;
  history: StewardHistory | undefined;
  now: number;
}) {
  const network = NETWORKS[data.network];

  return (
    <Panel title="Recent automatic actions" id="recent-title">
      {!history ? (
        <Spinner caption={`Reading the executor's events on ${network.base.name}`} />
      ) : history.recent.length === 0 ? (
        <p className="text-ink-secondary">
          Nothing yet. Your first split shows here once USDC arrives from a listed sender.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {history.recent.map((action) => (
            <li key={action.hash} className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm">
                  <ExternalLink href={txUrl(network.baseExplorer, action.hash)}>
                    {shortAddress(action.hash)}
                  </ExternalLink>
                </span>
                <p className="font-mono text-sm text-ink-muted">
                  {action.at > 0 ? formatAgo(now - action.at) : "time unknown"} | {RULE[action.kind]}
                </p>
              </div>
              <p className="shrink-0 text-right font-mono text-sm text-ink-default">{amountText(action)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function amountText(action: RecentAction): string {
  if (action.kind === "release") return "all to beneficiary";
  if (action.amount === null) return "vested tokens";
  return `+${formatAmount(action.amount, USDC_DECIMALS, "USDC")}`;
}
