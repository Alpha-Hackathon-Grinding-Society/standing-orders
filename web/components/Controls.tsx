"use client";

import { useId, useState } from "react";
import { executorAbi, vaultAbi } from "@/lib/abi";
import type { StewardData } from "@/lib/data";
import { formatAmount, parseAmount, shortAddress } from "@/lib/format";
import { NETWORKS, addressUrl } from "@/lib/networks";
import { USDC_DECIMALS } from "@/lib/setup";
import { type TxStatus, errorText } from "@/lib/tx";
import { send, waitFor } from "@/lib/wallet";
import { TxRow } from "./TxRow";
import { BracketButton, ExternalLink, Notice, Panel } from "./ui";

type Props = { data: StewardData; preview: boolean; onDone: () => void };

/** `[ PAUSE ALL ]` (with a confirm step) and `[ WITHDRAW ]`, both on Base. */
export function Controls({ data, preview, onDone }: Props) {
  const network = NETWORKS[data.network];
  const d = network.deployment;
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [tx, setTx] = useState<{ label: string; status: TxStatus } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amountId = useId();
  const amountError = useId();

  const parsed = parseAmount(amount, USDC_DECIMALS);
  const invalid =
    parsed === null || parsed === 0n
      ? "Enter an amount of USDC, for example 10."
      : parsed > data.vaultBalance
        ? `Your vault holds ${formatAmount(data.vaultBalance, USDC_DECIMALS, "USDC")}. Enter that or less.`
        : null;
  const busy = tx?.status.state === "pending";

  async function run(label: string, call: Parameters<typeof send>[1], after?: () => void) {
    setError(null);
    setTx({ label, status: { state: "pending", note: "CONFIRM IN WALLET" } });
    try {
      const hash = await send(network.base, call);
      setTx({ label, status: { state: "pending", hash, explorer: network.baseExplorer } });
      await waitFor(network, network.base, hash);
      setTx({ label, status: { state: "success", hash, explorer: network.baseExplorer } });
      after?.();
      onDone();
    } catch (e) {
      setTx({ label, status: { state: "failed" } });
      setError(errorText(e));
    }
  }

  if (!d || !data.vault) return null;
  const vault = data.vault;

  return (
    <Panel title="Controls" id="controls-title">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {data.paused ? (
            <Notice tone="warning" symbol="[!]" word="PAUSED">
              Your Rulebook sends nothing while you are paused. Withdraw still works.
            </Notice>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {data.paused ? (
              <BracketButton
                disabled={preview || busy}
                onClick={() => run("Unpause", { address: d.ordersExecutor, abi: executorAbi, functionName: "unpause" })}
              >
                Unpause
              </BracketButton>
            ) : (
              <BracketButton disabled={preview || busy} aria-expanded={confirming} onClick={() => setConfirming(true)}>
                Pause all
              </BracketButton>
            )}
            <BracketButton
              disabled={preview || busy}
              aria-expanded={withdrawing}
              onClick={() => setWithdrawing((w) => !w)}
            >
              Withdraw
            </BracketButton>
          </div>

          {confirming && !data.paused ? (
            <div
              role="group"
              aria-label="Confirm pause"
              className="flex flex-col gap-2 rounded-md bg-surface-raised p-3"
            >
              <p>
                Pause every rule? Nothing is split, claimed or released until you unpause. Pausing counts as activity.
              </p>
              <div className="flex flex-wrap gap-2">
                <BracketButton
                  disabled={busy}
                  className="text-warning"
                  onClick={() =>
                    run("Pause all", { address: d.ordersExecutor, abi: executorAbi, functionName: "pause" }, () =>
                      setConfirming(false),
                    )
                  }
                >
                  Yes, pause all
                </BracketButton>
                <BracketButton onClick={() => setConfirming(false)}>Cancel</BracketButton>
              </div>
            </div>
          ) : null}

          {withdrawing ? (
            <form
              className="flex flex-col gap-2 rounded-md bg-surface-raised p-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (invalid || parsed === null) return;
                run(
                  "Withdraw",
                  { address: vault, abi: vaultAbi, functionName: "withdraw", args: [d.usdc, parsed] },
                  () => {
                    setAmount("");
                    setTouched(false);
                    setWithdrawing(false);
                  },
                );
              }}
            >
              <label htmlFor={amountId} className="font-mono text-sm uppercase text-ink-secondary">
                Amount to withdraw (USDC)
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={amountId}
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={touched && invalid !== null}
                  aria-describedby={touched && invalid ? amountError : undefined}
                  placeholder={formatAmount(data.vaultBalance, USDC_DECIMALS)}
                  className="min-h-11 w-40 rounded-md bg-surface-input px-3 font-mono text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-royal"
                />
                <BracketButton
                  onClick={() => {
                    setAmount(
                      formatAmount(data.vaultBalance, USDC_DECIMALS, undefined, USDC_DECIMALS).replace(/ /g, ""),
                    );
                    setTouched(true);
                  }}
                >
                  Max
                </BracketButton>
                <BracketButton type="submit" disabled={busy}>
                  Withdraw to my wallet
                </BracketButton>
              </div>
              {touched && invalid ? (
                <p id={amountError} className="text-sm text-danger-text">
                  {invalid}
                </p>
              ) : null}
            </form>
          ) : null}

          {tx ? (
            <ul>
              <TxRow label={tx.label} status={tx.status} />
            </ul>
          ) : null}
          {error ? (
            <Notice tone="danger" symbol="(x)" word="FAILED">
              {error}
            </Notice>
          ) : null}
        </div>
        <ReactBalance data={data} />
      </div>
    </Panel>
  );
}

/** The Rulebook's REACT balance, with `[!] LOW REACT` when about three days or less remain. */
function ReactBalance({ data }: { data: StewardData }) {
  const network = NETWORKS[data.network];
  const rb = data.rulebook;
  if (!rb) return null;
  const symbol = network.reactive.nativeCurrency.symbol;
  const days = Number((rb.balance * 10n) / network.reactPerDay) / 10;

  return (
    <div className="flex flex-col gap-2 border-t border-hairline pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
      <h3 className="font-mono text-sm uppercase text-ink-muted">{"// REACT balance"}</h3>
      <p className="font-mono text-sm text-ink-mono">
        <span className="text-ink">{formatAmount(rb.balance, 18, symbol)}</span> · about {days} day
        {days === 1 ? "" : "s"} of checks left ·{" "}
        <ExternalLink href={addressUrl(network.reactiveExplorer, rb.address)}>
          Rulebook {shortAddress(rb.address)}
        </ExternalLink>
      </p>
      {rb.debt > 0n ? (
        <Notice tone="danger" symbol="(x)" word="OUT OF REACT">
          Your Rulebook owes {formatAmount(rb.debt, 18, symbol, 4)} and receives no events until it is topped up. Run{" "}
          <code>make top-up-react</code>.
        </Notice>
      ) : rb.balance < network.lowReact ? (
        <Notice tone="warning" symbol="[!]" word="LOW REACT">
          Top up before it runs out: <code>make top-up-react</code>. At zero your rules stop until you do.
        </Notice>
      ) : null}
    </div>
  );
}
