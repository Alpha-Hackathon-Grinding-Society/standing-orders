"use client";

import { shortAddress } from "@/lib/format";
import { txUrl } from "@/lib/networks";
import type { TxStatus } from "@/lib/tx";
import { ExternalLink, StatusToken } from "./ui";

/** One signature as a mono row: `(~) WAITING` → `(~) PENDING` → `(v) SUCCESS 0x1234...` or `(x) FAILED`. */
export function TxRow({ label, status }: { label: string; status: TxStatus }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <span className="text-ink-default">{label}</span>
      <span className="flex flex-wrap items-baseline gap-2 font-mono text-sm" aria-live="polite">
        <TxToken status={status} />
        {status.hash && status.explorer ? (
          <ExternalLink href={txUrl(status.explorer, status.hash)}>{shortAddress(status.hash)}</ExternalLink>
        ) : null}
      </span>
    </li>
  );
}

function TxToken({ status }: { status: TxStatus }) {
  switch (status.state) {
    case "waiting":
      return <StatusToken symbol="( )" word={status.note ?? "WAITING"} tone="muted" />;
    case "pending":
      return <StatusToken symbol="(~)" word={status.note ?? "PENDING"} tone="info" />;
    case "success":
      return <StatusToken symbol="(v)" word={status.note ?? "SUCCESS"} tone="success" />;
    case "failed":
      return <StatusToken symbol="(x)" word="FAILED" tone="danger" />;
  }
}
