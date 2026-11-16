// Transaction status rows and the one-sentence failure text the page shows after `(x) FAILED`.
import type { Hash } from "viem";

export type TxState = "waiting" | "pending" | "success" | "failed";
export type TxStatus = { state: TxState; hash?: Hash; explorer?: string; note?: string };

export const WAITING: TxStatus = { state: "waiting" };

/** Turns a wallet or RPC error into one sentence that says what happened and what to do next. */
export function errorText(error: unknown): string {
  const e = error as { code?: number; name?: string; shortMessage?: string; message?: string; cause?: unknown };
  const text = `${e?.name ?? ""} ${e?.shortMessage ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (
    e?.code === 4001 ||
    text.includes("userrejected") ||
    text.includes("user rejected") ||
    text.includes("user denied")
  ) {
    return "You declined in your wallet. Press the button again when you are ready.";
  }
  if (text.includes("insufficient funds") || text.includes("exceeds the balance")) {
    return "Your wallet does not hold enough for this transaction and its network fee. Add funds, then try again.";
  }
  if (e?.code === -32002 || text.includes("already pending")) {
    return "Your wallet already has a request open. Open it, approve or reject that request, then try again.";
  }
  if (text.includes("reverted")) {
    return "The transaction was rejected on-chain. Nothing moved; check the details and try again.";
  }
  const short = e?.shortMessage ?? e?.message ?? String(error);
  return `${short.split("\n")[0].replace(/\.$/, "")}. Try again, or use the matching make command from the README.`;
}
