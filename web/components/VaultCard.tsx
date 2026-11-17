"use client";

import type { StewardData } from "@/lib/data";
import { amountParts, shortAddress } from "@/lib/format";
import { NETWORKS, addressUrl } from "@/lib/networks";
import { USDC_DECIMALS } from "@/lib/setup";
import { Odometer } from "./motion/Odometer";
import { ExternalLink, Label } from "./ui";

/** The one large stat on the page, under the page's only gradient (a 1px top border) and its one soft glow. */
export function VaultCard({ data }: { data: StewardData }) {
  const network = NETWORKS[data.network];
  const [whole, cents] = amountParts(data.vaultBalance, USDC_DECIMALS);

  return (
    <section
      aria-labelledby="vault-title"
      className="gradient-top royal-glow flex flex-col gap-6 rounded-xl border border-hairline bg-surface p-4 md:p-6"
    >
      <Label id="vault-title">Vault balance</Label>
      <p className="flex flex-wrap items-baseline gap-3 text-ink">
        <span className="text-display font-normal tabular-nums">
          <Odometer text={whole} />
          <span className="text-ink-muted">
            <Odometer text={cents} />
          </span>
        </span>
        <span className="font-mono text-base text-ink-mono">USDC</span>
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
