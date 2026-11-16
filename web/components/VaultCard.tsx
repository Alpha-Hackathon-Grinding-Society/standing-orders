"use client";

import type { StewardData, StewardHistory } from "@/lib/data";
import { formatAmount, shortAddress } from "@/lib/format";
import { NETWORKS, addressUrl } from "@/lib/networks";
import { USDC_DECIMALS } from "@/lib/setup";
import { ExternalLink, Label } from "./ui";

/** The one large stat on the page, under the page's only gradient (a 1px top border). */
export function VaultCard({ data, history }: { data: StewardData; history: StewardHistory | undefined }) {
  const network = NETWORKS[data.network];
  const whole = formatAmount(data.vaultBalance, USDC_DECIMALS);
  const days = history?.since ? Math.max(0, Math.floor((data.now - history.since) / 86_400)) : null;

  return (
    <section
      aria-labelledby="vault-title"
      className="gradient-top flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 md:p-6"
    >
      <Label id="vault-title">Vault balance</Label>
      <p className="flex flex-wrap items-baseline gap-3 text-ink">
        <span className="text-display font-normal tabular-nums">{whole}</span>
        <span className="font-mono text-base text-ink-mono">USDC</span>
      </p>
      <p className="font-mono text-sm text-ink-mono">
        {history ? (
          <>
            <span className="text-success">^ {formatAmount(history.savedTotal, USDC_DECIMALS, "USDC")}</span> saved
            automatically
            {days !== null ? ` · running ${days} day${days === 1 ? "" : "s"}` : ""}
          </>
        ) : (
          "Reading your savings history..."
        )}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
        <dt className="text-ink-muted">Vault</dt>
        <dd>
          {data.vault ? (
            <ExternalLink href={addressUrl(network.baseExplorer, data.vault)}>{shortAddress(data.vault)}</ExternalLink>
          ) : (
            "none"
          )}
        </dd>
        <dt className="text-ink-muted">Beneficiary</dt>
        <dd className="text-ink-mono">{data.beneficiary ? shortAddress(data.beneficiary) : "not set"}</dd>
        <dt className="text-ink-muted">Cold wallet</dt>
        <dd className="text-ink-mono">
          {data.coldWallet ? shortAddress(data.coldWallet) : "none, claims stay in the vault"}
        </dd>
      </dl>
    </section>
  );
}
