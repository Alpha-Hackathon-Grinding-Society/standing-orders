"use client";

import { useState } from "react";
import { heartbeatAbi } from "@/lib/abi";
import type { StewardData } from "@/lib/data";
import { formatAgo } from "@/lib/format";
import { guardianView } from "@/lib/guardian";
import { NETWORKS, chainName } from "@/lib/networks";
import { type TxStatus, WAITING, errorText } from "@/lib/tx";
import { send, waitFor } from "@/lib/wallet";
import { TxRow } from "./TxRow";
import { Notice, Panel, PrimaryButton, StatusToken } from "./ui";

/** Guardian state as symbol + word, the countdown in mono, last activity per chain and `[ I'M ALIVE ]`. */
export function GuardianCard({
  data,
  now,
  preview,
  onDone,
}: {
  data: StewardData;
  now: number;
  preview: boolean;
  onDone: () => void;
}) {
  const network = NETWORKS[data.network];
  const [tx, setTx] = useState<TxStatus>(WAITING);
  const [error, setError] = useState<string | null>(null);
  const rb = data.rulebook;

  if (!rb) {
    return (
      <Panel title="Guardian" id="guardian-title">
        <Notice tone="warning" symbol="[!]" word="UNREACHABLE">
          Could not read your Rulebook on {network.reactive.name}. Your vault is safe; the page retries every 15
          seconds.
        </Notice>
      </Panel>
    );
  }

  const view = guardianView({ ...rb, now, paused: data.paused });

  async function imAlive() {
    const d = network.deployment;
    if (!d) return;
    setError(null);
    setTx({ state: "pending", note: "CONFIRM IN WALLET" });
    try {
      const hash = await send(network.base, { address: d.heartbeat, abi: heartbeatAbi, functionName: "alive" });
      setTx({ state: "pending", hash, explorer: network.baseExplorer });
      await waitFor(network, network.base, hash);
      setTx({ state: "success", hash, explorer: network.baseExplorer, note: "SENT" });
      onDone();
    } catch (e) {
      setTx({ state: "failed" });
      setError(errorText(e));
    }
  }

  return (
    <Panel title="Guardian" id="guardian-title">
      <div className="flex flex-col gap-1">
        <p className="text-2xl md:text-3xl">
          <StatusToken symbol={view.symbol} word={view.word} tone={view.tone} />
        </p>
        <p className="font-mono text-base text-ink">{view.countdown}</p>
        <p className="text-ink-secondary">{view.detail}</p>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-mono text-sm uppercase text-ink-muted">Last activity</h3>
        <ul className="flex flex-col gap-1 font-mono text-sm">
          {rb.lastActive.map(({ chainId, at }) => (
            <li key={chainId} className="flex justify-between gap-4">
              <span className="text-ink-mono">{chainName(chainId)}</span>
              <span className="text-ink-default">{at > 0 ? formatAgo(now - at) : "nothing seen yet"}</span>
            </li>
          ))}
        </ul>
      </div>

      {view.word !== "RELEASED" && view.word !== "OFF" ? (
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={imAlive} disabled={preview || tx.state === "pending"} className="self-start">
            I&apos;m alive
          </PrimaryButton>
          <p className="text-sm text-ink-muted">
            Sends one small transaction on {network.base.name}. Your Rulebook sees it within a minute and resets the
            clock.
          </p>
          {tx.state !== "waiting" ? (
            <ul>
              <TxRow label="I'm alive" status={tx} />
            </ul>
          ) : null}
          {error ? (
            <Notice tone="danger" symbol="(x)" word="FAILED">
              {error}
            </Notice>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
