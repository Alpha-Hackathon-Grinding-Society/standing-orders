"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Inflow, type StewardData, loadPaymentDetails } from "@/lib/data";
import { formatAgo, formatAmount } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { type SourceKey, formatCount, formatEth, formatUtc, paymentEnds } from "@/lib/moneyMap";
import { type Network, addressUrl, txUrl } from "@/lib/networks";
import { previewPaymentDetails } from "@/lib/preview";
import { Odometer } from "../motion/Odometer";
import { Scramble } from "../motion/Scramble";
import { BracketButton, ExternalLink, StatusToken } from "../ui";

const SOURCE_NAME: Record<SourceKey, string> = { income: "Income", vesting: "Vesting", deposits: "Deposit" };

const rows = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/**
 * The picked payment in full, in the map's own style: a glass panel that rises out of blur beside
 * the wheel, its rows arriving one after another, the hash decoding and the amount rolling into place.
 * Picking another payment swaps the rows; `[ Close ]` or Escape puts it away.
 */
export function PaymentPanel({
  item,
  source,
  data,
  network,
  preview,
  now,
  style,
  onClose,
}: {
  item: Inflow;
  source: SourceKey;
  data: StewardData;
  network: Network;
  preview: boolean;
  now: number;
  style: React.CSSProperties;
  onClose: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const details = useQuery({
    queryKey: ["payment", network.key, item.hash],
    queryFn: () => loadPaymentDetails(network.key, item.hash),
    enabled: !preview,
    staleTime: 30_000,
  });
  const info = preview ? previewPaymentDetails(item) : details.data;
  const ends = paymentEnds(source);
  const to = source === "income" ? data.user : (data.vault ?? data.user);
  const amount = formatAmount(item.amount, item.decimals, undefined, item.decimals > 6 ? 4 : 2);

  return (
    <motion.section
      aria-label="Payment details"
      className="absolute z-20 flex select-text flex-col overflow-hidden rounded-xl border border-hairline bg-surface-glass backdrop-blur-md"
      style={style}
      initial={reduce ? false : { opacity: 0, x: -24, scale: 0.98, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16, scale: 0.98, filter: "blur(6px)" }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="map-detail-edge" aria-hidden="true" />
      <header className="flex items-center justify-between gap-2 border-b border-hairline py-1 pr-1 pl-4">
        <h3 className="font-mono text-sm uppercase text-ink-muted">
          {"// "}Payment · {SOURCE_NAME[source]}
        </h3>
        <BracketButton onClick={onClose}>Close</BracketButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait" initial={!reduce}>
          <motion.div
            key={item.id}
            className="flex flex-col gap-4"
            initial="hidden"
            animate="shown"
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" } }}
            variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } } }}
          >
            <motion.p variants={rows} className="flex items-baseline gap-2">
              <span className="text-4xl tabular-nums text-ink">
                <span className="text-ink-muted">{source === "income" ? "" : "+"}</span>
                <Odometer text={amount} />
              </span>
              <span className="font-mono text-sm text-ink-mono">{item.symbol}</span>
            </motion.p>

            <motion.p variants={rows} className="text-sm">
              {info ? (
                info.status === "success" ? (
                  <StatusToken symbol="(v)" word="CONFIRMED" tone="success" />
                ) : (
                  <StatusToken symbol="(x)" word="REVERTED" tone="danger" />
                )
              ) : details.isError ? (
                <StatusToken symbol="(x)" word="FAILED" tone="danger" />
              ) : (
                <StatusToken symbol="(~)" word="READING" tone="info" />
              )}{" "}
              <span className="text-ink-muted">
                ·{" "}
                {info
                  ? `${formatCount(info.confirmations)} ${info.confirmations === 1n ? "confirmation" : "confirmations"}`
                  : details.isError
                    ? "Could not read this transaction from Base. The link below still opens it."
                    : `Reading the transaction from ${network.base.name}`}
              </span>
            </motion.p>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 font-mono text-sm">
              <Row label="Hash">
                {/* `anywhere`: the decoding noise is brackets, which never offer a line break of their own. */}
                <span className="block break-all text-ink [overflow-wrap:anywhere]">
                  <Scramble text={item.hash} duration={900} />
                </span>
                <CopyHash hash={item.hash} />
              </Row>
              <Row label={ends.from}>
                <Address value={item.from} network={network} you={source === "deposits"} />
              </Row>
              <Row label={ends.to}>
                <Address
                  value={to}
                  network={network}
                  you={source === "income"}
                  note={source === "income" ? undefined : "your vault"}
                />
              </Row>
              <Row label="Token">
                <span className="text-ink">{item.symbol}</span>{" "}
                <ExternalLink href={addressUrl(network.baseExplorer, item.token)}>
                  {`${item.token.slice(0, 8)}...${item.token.slice(-8)}`}
                </ExternalLink>
              </Row>
              <Row label="Block">
                <span className="text-ink">#{formatCount(item.block)}</span>
                {item.at > 0 ? (
                  <span className="block text-ink-muted">
                    {formatUtc(item.at)} · {formatAgo(now - item.at)}
                  </span>
                ) : null}
              </Row>
              <Row label="Fee">
                {info ? (
                  <>
                    <span className="text-ink">{formatEth(info.fee)}</span>
                    <span className="block text-ink-muted">{formatCount(info.gasUsed)} gas</span>
                  </>
                ) : (
                  <Reading failed={details.isError} />
                )}
              </Row>
              {/* Only when someone else sent it, such as Reactive's callback for a vesting claim. */}
              {info && info.signer.toLowerCase() !== item.from.toLowerCase() ? (
                <Row label="Sent by">
                  <Address value={info.signer} network={network} />
                </Row>
              ) : null}
              <Row label="Position">
                <span className="text-ink">log {item.logIndex}</span>
                {info ? <span className="text-ink-muted"> · nonce {info.nonce}</span> : null}
              </Row>
              <Row label="Network">
                <span className="text-ink">{network.base.name}</span>
              </Row>
            </dl>

            {source === "income" && data.rulebook ? (
              <motion.p variants={rows} className="text-sm text-ink-secondary">
                Pay yourself first saves {data.rulebook.splitBps / 100}% of each payment from a listed sender into your
                vault, within your cap.
              </motion.p>
            ) : null}

            <motion.div variants={rows}>
              <ExternalLink href={txUrl(network.baseExplorer, item.hash)}>
                View the transaction on Basescan
              </ExternalLink>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/** One label and value pair; each arrives as a row of the stagger. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <motion.div variants={rows} className="col-span-2 grid grid-cols-subgrid">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </motion.div>
  );
}

/** A full address, linked to the explorer, with "you" or another note beside it when it is yours. */
function Address({ value, network, you, note }: { value: string; network: Network; you?: boolean; note?: string }) {
  return (
    <span className="block min-w-0">
      <a
        href={addressUrl(network.baseExplorer, value)}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-ink underline-offset-4 hover:text-maya hover:underline"
      >
        {value}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {you || note ? <span className="block text-ink-muted">{note ?? "you"}</span> : null}
    </span>
  );
}

function Reading({ failed }: { failed: boolean }) {
  return failed ? (
    <span className="text-ink-muted">not available</span>
  ) : (
    <span className="shimmer block h-[1lh] w-32 rounded-sm">
      <span className="sr-only">Reading</span>
    </span>
  );
}

/** `[ Copy ]`, which reads `[ Copied ]` for a moment once the hash is on the clipboard. */
function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <BracketButton
      className="-ml-3 mt-1"
      aria-label={copied ? "Hash copied" : "Copy hash"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(hash);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (no permission or not a secure page): the hash is still selectable.
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </BracketButton>
  );
}
