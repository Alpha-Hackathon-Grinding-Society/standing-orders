"use client";

import { zeroAddress } from "viem";
import type { StewardData } from "@/lib/data";
import { formatAmount, formatDuration, joinWords, shortAddress } from "@/lib/format";
import { chainName } from "@/lib/networks";
import { USDC_DECIMALS } from "@/lib/setup";
import { Label, type Tone, toneClass } from "./ui";

type Rule = { key: string; title: string; icon: string; on: boolean; sentence: string; meta?: string };

const usdc = (raw: bigint) => formatAmount(raw, USDC_DECIMALS, "USDC");

/** The three rules, each as one plain sentence with `[ ON ]` or `[ OFF ]` (marketing-card style). */
export function RuleCards({ data }: { data: StewardData }) {
  const rb = data.rulebook;
  if (!rb) return null;

  const senders = joinWords(rb.incomeSenders.map(shortAddress)) || "nobody yet";
  const rules: Rule[] = [
    {
      key: "split",
      title: "Pay yourself first",
      icon: ".-.\n|$|\n'%'",
      on: rb.splitBps > 0 && rb.incomeSenders.length > 0,
      sentence: `Save ${rb.splitBps / 100}% of USDC from ${senders}, at most ${usdc(rb.periodCap)} every ${formatDuration(rb.periodLength)}.`,
      meta: `${usdc(rb.splitThisPeriod)} of ${usdc(rb.periodCap)} saved this period · ${usdc(data.allowance)} budget left`,
    },
    {
      key: "claim",
      title: "Claim and secure",
      icon: "[=]\n v \n[#]",
      on: rb.vesting !== zeroAddress,
      sentence:
        rb.vesting !== zeroAddress
          ? `Every ${formatDuration(rb.claimInterval)}, claim what has vested in ${shortAddress(rb.vesting)} and move it into your vault${
              data.coldWallet ? `, then on to your cold wallet ${shortAddress(data.coldWallet)}` : ""
            }.`
          : "Off. Claiming vested tokens needs a Rulebook that names your vesting contract.",
    },
    {
      key: "guardian",
      title: "Guardian",
      icon: "/^\\\n|o|\n\\_/",
      on: rb.silencePeriod > 0,
      sentence:
        rb.silencePeriod > 0
          ? `If you are silent for ${formatDuration(rb.silencePeriod)} on ${joinWords(rb.watchedChains.map(chainName))}, warn you, wait ${formatDuration(
              rb.gracePeriod,
            )}, then send your savings to ${data.beneficiary ? shortAddress(data.beneficiary) : "your beneficiary"}.`
          : "Off. Your savings stay in the vault however long you are away.",
    },
  ];

  return (
    <section aria-labelledby="rules-title" className="flex flex-col gap-4">
      <Label id="rules-title">Your rules</Label>
      <ul className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
        {rules.map((rule) => {
          const [word, tone]: [string, Tone] = !rule.on
            ? ["OFF", "muted"]
            : data.paused
              ? ["PAUSED", "warning"]
              : ["ON", "success"];
          return (
            <li
              key={rule.key}
              className="flex flex-col gap-3 rounded-xl border-2 border-hairline bg-linear-to-b from-card-from to-surface p-4 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <pre aria-hidden="true" className="font-mono text-xs leading-4 text-ink-muted">
                  {rule.icon}
                </pre>
                <span className={`font-mono text-sm ${toneClass(tone)}`}>[ {word} ]</span>
              </div>
              <h3 className="text-xl font-medium text-ink">{rule.title}</h3>
              <p className="text-ink-secondary">{rule.sentence}</p>
              {rule.meta && rule.on ? <p className="font-mono text-sm text-ink-mono">{rule.meta}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-sm text-ink-muted">
        Rules change by script: <code className="text-ink-mono">make edit-rules</code> (see the README).
      </p>
    </section>
  );
}
