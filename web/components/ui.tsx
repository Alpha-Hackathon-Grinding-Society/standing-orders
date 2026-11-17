"use client";

// Shared pieces every card uses, so the DESIGN.md rules live in one place:
// `// LABEL` headers, hairline panels, bracket and primary buttons, status tokens and the ASCII spinner.
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "quartz" | "muted";

const toneText: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger-text",
  info: "text-maya",
  quartz: "text-quartz",
  muted: "text-ink-muted",
};

export function toneClass(tone: Tone): string {
  return toneText[tone];
}

/** `// TITLE` section label: mono 14, uppercase, 50% white. */
export function Label({
  children,
  id,
  right,
  level = 2,
}: {
  children: ReactNode;
  id?: string;
  right?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Heading id={id} className="scroll-mt-8 font-mono text-sm uppercase text-ink-muted">
        {"// "}
        {children}
      </Heading>
      {right ? <div className="font-mono text-sm text-ink-muted">{right}</div> : null}
    </div>
  );
}

/** App panel: #101010, 1px hairline, 8px radius, 16px padding, labelled by its `// TITLE`. */
export function Panel({
  title,
  id,
  right,
  className = "",
  children,
}: {
  title: string;
  id: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 ${className}`}
    >
      <Label id={id} right={right}>
        {title}
      </Label>
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

/** Bracket button, the default action: `[ ACTION ]` in mono uppercase. */
export function BracketButton({ children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`min-h-11 cursor-pointer rounded-md px-3 py-2 font-mono text-sm uppercase text-ink-default transition-colors duration-300 ease-reactive hover:bg-surface-active hover:text-white disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent ${className}`}
      {...rest}
    >
      [ {children} ]
    </button>
  );
}

/** The one Royal button on the page. */
export function PrimaryButton({ children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`min-h-11 cursor-pointer rounded-md bg-royal px-4 py-2 font-mono text-sm font-medium uppercase text-white transition-colors duration-300 ease-reactive hover:bg-royal-hover disabled:cursor-default disabled:opacity-45 ${className}`}
      {...rest}
    >
      [ {children} ]
    </button>
  );
}

/** Status written as symbol plus word, e.g. `(v) SUCCESS`; only the token is coloured. */
export function StatusToken({ symbol, word, tone }: { symbol: string; word: string; tone: Tone }) {
  return (
    <span className={`font-mono ${toneClass(tone)}`}>
      {symbol} {word}
    </span>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-maya underline-offset-4 hover:underline"
    >
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const SPIN = ["+:+", ":+:", "+.+", ".+."];

/** ASCII spinner over a mono caption. Holds still when reduced motion is preferred. */
export function Spinner({ caption }: { caption: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPIN.length), 180);
    return () => clearInterval(id);
  }, []);
  return (
    <div role="status" className="flex flex-col items-center gap-2 py-16 font-mono text-sm text-ink-muted">
      <span aria-hidden="true" className="text-lg text-ink-mono">
        {SPIN[frame]}
      </span>
      <span>{caption}</span>
    </div>
  );
}

/** A small hairline-free notice line, e.g. `[!] LOW REACT` or `(x) FAILED`, with role=alert for failures. */
export function Notice({
  tone,
  symbol,
  word,
  children,
}: {
  tone: Tone;
  symbol: string;
  word: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className="rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm text-ink-default"
    >
      <StatusToken symbol={symbol} word={word} tone={tone} /> <span className="text-ink-muted">·</span> {children}
    </div>
  );
}

/** Ticks once a second, for countdowns. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
