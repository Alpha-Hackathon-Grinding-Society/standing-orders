"use client";

import { type MotionValue, motion } from "motion/react";
import type { CSSProperties } from "react";
import type { Inflow } from "@/lib/data";
import { EASE_OUT } from "@/lib/motion";
import {
  type MapLayout,
  type SourceKey,
  cometTiming,
  fanPath,
  inflowAmount,
  inflowSource,
  leafPoint,
  shortAgo,
} from "@/lib/moneyMap";
import { useLeafMotion } from "./useLeafMotion";

/** How a payment is drawn right now: the one picked, the one under the pointer, or the rest. */
export type LeafEmphasis = "rest" | "dim" | "hover" | "focus";

const lineOpacity: Record<LeafEmphasis, number> = { rest: 0.55, dim: 0.2, hover: 1, focus: 1 };

type Shared = {
  i: number;
  centerIndex: number;
  wheel: MotionValue<number>;
  layout: MapLayout;
  emphasis: LeafEmphasis;
  /** Seconds before this payment's line starts drawing; null holds it undrawn. */
  delay: number | null;
  reduce: boolean;
};

/**
 * One payment in the drawing: its fan line, a Maya comet running along it now and then, and its dot.
 * Lines draw from the middle payment outwards and the dot pops in as its line arrives.
 */
export function LeafLine({ comet, ...props }: Shared & { comet: boolean }) {
  const { i, centerIndex, wheel, layout, emphasis, delay, reduce } = props;
  const leaf = useLeafMotion(wheel, i, centerIndex, layout);
  const drawn = delay !== null;
  const timing = cometTiming(i);
  const strong = emphasis === "hover" || emphasis === "focus";

  return (
    <g style={{ opacity: lineOpacity[emphasis] }} className="transition-opacity duration-150 ease-settle">
      <motion.path
        d={leaf.d}
        fill="none"
        className="stroke-maya"
        strokeWidth={strong ? 1.75 : 1}
        style={{ opacity: leaf.opacity }}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: drawn || reduce ? 1 : 0 }}
        exit={reduce ? undefined : { pathLength: 0, transition: { duration: 0.26, ease: "easeIn" } }}
        transition={{ duration: 0.6, delay: delay ?? 0, ease: EASE_OUT }}
      />
      {comet && drawn && !reduce ? (
        <g
          style={
            {
              "--dur": `${timing.duration.toFixed(2)}s`,
              "--delay": `${(timing.delay + (delay ?? 0) + 0.6).toFixed(2)}s`,
            } as CSSProperties
          }
        >
          <motion.path
            d={leaf.d}
            pathLength={1}
            fill="none"
            className="map-comet stroke-maya"
            strokeWidth={1.5}
            filter="url(#map-glow-sm)"
            style={{ opacity: leaf.opacity }}
          />
        </g>
      ) : null}
      {emphasis === "focus" && !reduce ? (
        <motion.circle cx={leaf.x} cy={leaf.y} r={6} className="map-focus-ring fill-none stroke-maya" />
      ) : null}
      {/* The twinkle scales a wrapper, so it never fights the dot's own pop-in. */}
      <g className={reduce ? "" : "map-twinkle"} style={{ "--delay": `${(i * 1.5) % 9}s` } as CSSProperties}>
        <motion.circle
          cx={leaf.x}
          cy={leaf.y}
          r={emphasis === "focus" ? 3.5 : 2.5}
          className="fill-maya"
          filter="url(#map-glow-sm)"
          style={{ opacity: leaf.opacity }}
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: drawn || reduce ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8, delay: (delay ?? 0) + 0.51 }}
        />
      </g>
    </g>
  );
}

/**
 * One payment's label, right of its dot: who paid and how long ago, then the amount and token.
 * An `option` in the wheel's listbox; the full source and amount are in its tooltip.
 */
export function LeafLabel({
  id,
  item,
  source,
  now,
  left,
  onPick,
  onHover,
  ...props
}: Shared & {
  id: string;
  item: Inflow;
  source: SourceKey;
  now: number;
  /** The listbox's left edge in canvas px, so labels can be placed in canvas coordinates. */
  left: number;
  onPick: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const { i, centerIndex, wheel, layout, emphasis, delay, reduce } = props;
  const leaf = useLeafMotion(wheel, i, centerIndex, layout);
  const drawn = delay !== null;
  const amount = inflowAmount(item, source);
  const who = inflowSource(source, item);

  return (
    <motion.div
      className="absolute top-0 left-0 origin-left"
      style={{ x: leaf.x, y: leaf.y, opacity: leaf.opacity, scale: leaf.scale, pointerEvents: leaf.pointerEvents }}
      transformTemplate={(_, generated) => `translateX(${-left}px) ${generated === "none" ? "" : generated}`}
    >
      <motion.div
        id={id}
        role="option"
        aria-selected={emphasis === "focus"}
        title={`${source === "deposits" ? "Your deposit" : item.from} · ${amount}`}
        onClick={onPick}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        // The name's line sits level with the dot; the amount hangs below it.
        className={`flex min-h-11 -translate-y-2.5 cursor-pointer flex-col gap-0.5 pl-2.5 transition-opacity duration-150 ease-settle ${
          emphasis === "dim" ? "opacity-50" : "opacity-100"
        }`}
        style={{ width: layout.labelW + 10 }}
        initial={reduce ? false : { opacity: 0, x: 6 }}
        animate={{ opacity: drawn || reduce ? 1 : 0, x: drawn || reduce ? 0 : 6 }}
        transition={{ duration: 0.3, delay: (delay ?? 0) + 0.54, ease: EASE_OUT }}
      >
        <span className="flex items-baseline justify-between gap-2 leading-5">
          <span
            className={`truncate font-mono text-sm ${emphasis === "focus" ? "font-medium text-ink" : "text-ink-default"}`}
          >
            {who}
          </span>
          <span className="shrink-0 font-mono text-xs text-ink-muted">
            {item.at > 0 ? shortAgo(now - item.at) : ""}
          </span>
        </span>
        <span className="self-start truncate rounded-full border border-hairline bg-surface-raised px-2 font-mono text-xs leading-5 text-ink-mono">
          {amount}
        </span>
      </motion.div>
    </motion.div>
  );
}

/**
 * The wheel when a source has paid nothing yet: one dashed line to a hollow dot. The sentence beside it
 * is HTML in the canvas (MoneyMap), so screen readers get it too.
 */
export function GhostLine({ layout }: { layout: MapLayout }) {
  const point = leafPoint(0, layout.arcC, layout.arcR);
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <path d={fanPath(layout.anchor, point)} fill="none" className="stroke-ink-faint" strokeDasharray="3 5" />
      <circle cx={point.x} cy={point.y} r={3} className="fill-canvas stroke-ink-muted" />
    </motion.g>
  );
}
