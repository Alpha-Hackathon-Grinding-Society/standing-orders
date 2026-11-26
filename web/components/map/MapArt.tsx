"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { EASE_OUT } from "@/lib/motion";
import { type MapLayout, leafPoint, orbitMarks, trunkPath } from "@/lib/moneyMap";

/** When each part of the drawing arrives on first view, in seconds (DESIGN.md, Money map). */
export const INTRO = {
  halo: 0.08,
  rings: 0.26,
  trunks: 0.52,
  cards: 0.64,
  spark: 1.1,
  fan: 1.18,
  /** Between neighbouring payment lines, drawn from the middle outwards. */
  fanStep: 0.022,
  /** Everything is drawn: idle loops (comets) may start. */
  done: 2.1,
} as const;

type ArtProps = { layout: MapLayout; go: boolean; reduce: boolean };

const enter = (reduce: boolean, hidden: Record<string, number>) => (reduce ? false : hidden);

/** Filters and gradients, defined once. Colours come from the theme's CSS variables. */
export function MapDefs() {
  return (
    <defs>
      <filter id="map-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <radialGradient id="map-halo">
        <stop offset="0%" style={{ stopColor: "var(--color-surface-raised)", stopOpacity: 0.9 }} />
        <stop offset="100%" style={{ stopColor: "var(--color-surface-raised)", stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id="map-bloom">
        <stop offset="0%" style={{ stopColor: "var(--color-maya)", stopOpacity: 0.55 }} />
        <stop offset="100%" style={{ stopColor: "var(--color-maya)", stopOpacity: 0 }} />
      </radialGradient>
    </defs>
  );
}

/**
 * The vault's halo: a soft disc with a crisp edge, two faint guide rings, two slow Maya ripples, and
 * two counter-rotating rings of ticks and dots around the orb.
 */
export function RootArt({ layout, go, reduce }: ArtProps) {
  const { R0, rootR, orbR } = layout;
  const { ticks, dots } = orbitMarks(orbR + 14);
  const origin = { transformOrigin: `${R0.x}px ${R0.y}px`, transformBox: "view-box" } as CSSProperties;

  return (
    <g>
      <motion.g
        style={origin}
        initial={enter(reduce, { opacity: 0, scale: 0.6 })}
        animate={go || reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.9, delay: INTRO.halo, ease: EASE_OUT }}
      >
        <circle cx={R0.x} cy={R0.y} r={rootR} fill="url(#map-halo)" />
        <circle cx={R0.x} cy={R0.y} r={rootR} className="fill-none stroke-hairline" />
        <circle cx={R0.x} cy={R0.y} r={rootR * 1.25} className="fill-none stroke-hairline" opacity={0.4} />
        <circle cx={R0.x} cy={R0.y} r={rootR * 1.6} className="fill-none stroke-hairline" opacity={0.4} />
      </motion.g>
      {!reduce && go
        ? [0, 1.8].map((delay) => (
            <circle
              key={delay}
              cx={R0.x}
              cy={R0.y}
              r={rootR * 1.05}
              className="map-ripple fill-none stroke-maya"
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${delay + INTRO.done}s` }}
            />
          ))
        : null}
      <motion.g
        initial={enter(reduce, { opacity: 0 })}
        animate={{ opacity: go || reduce ? 1 : 0 }}
        transition={{ duration: 1, delay: INTRO.rings, ease: EASE_OUT }}
      >
        <g className={reduce ? "" : "map-spin"} style={{ ...origin, "--dur": "48s" } as CSSProperties}>
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={R0.x + t.r1 * Math.cos(t.a)}
              y1={R0.y + t.r1 * Math.sin(t.a)}
              x2={R0.x + t.r2 * Math.cos(t.a)}
              y2={R0.y + t.r2 * Math.sin(t.a)}
              className="stroke-ink-muted"
              opacity={t.opacity}
            />
          ))}
        </g>
        <g className={reduce ? "" : "map-spin map-spin-back"} style={{ ...origin, "--dur": "72s" } as CSSProperties}>
          {dots.map((dot, i) => (
            <circle
              key={i}
              cx={R0.x + dot.r * Math.cos(dot.a)}
              cy={R0.y + dot.r * Math.sin(dot.a)}
              r={1.2}
              className="fill-ink-muted"
            />
          ))}
        </g>
      </motion.g>
    </g>
  );
}

/** Lines from the orb to each source card; the picked one is lit and carries a comet. */
export function Trunks({ layout, go, reduce, selected }: ArtProps & { selected: number }) {
  const { R0, orbR, card, cardCenters } = layout;
  return (
    <g>
      {cardCenters.map((cy, i) => {
        const d = trunkPath({ x: R0.x + orbR + 2, y: R0.y }, { x: card.x - 2, y: cy });
        const active = i === selected;
        return (
          <g key={i}>
            <motion.path
              d={d}
              fill="none"
              className={`transition-[stroke,opacity] duration-300 ${active ? "stroke-maya" : "stroke-ink-muted"}`}
              strokeWidth={active ? 1.25 : 1}
              opacity={active ? 0.9 : 0.35}
              initial={enter(reduce, { pathLength: 0 })}
              animate={{ pathLength: go || reduce ? 1 : 0 }}
              transition={{ duration: 0.45, delay: INTRO.trunks + i * 0.06, ease: EASE_OUT }}
            />
            {active && go && !reduce ? (
              <path
                d={d}
                pathLength={1}
                fill="none"
                className="map-comet stroke-maya"
                strokeWidth={1.5}
                filter="url(#map-glow-sm)"
                style={{ "--dur": "3s", "--delay": `${INTRO.done}s` } as CSSProperties}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** The point the fan of payment lines leaves from; it slides to the picked card and breathes. */
export function Spark({ layout, go, reduce }: ArtProps) {
  const { anchor } = layout;
  return (
    <motion.g
      initial={reduce ? false : { y: anchor.y, opacity: 0, scale: 0 }}
      animate={go || reduce ? { y: anchor.y, opacity: 1, scale: [0, 1.4, 1] } : { y: anchor.y, opacity: 0, scale: 0 }}
      transition={{
        y: { type: "spring", stiffness: 420, damping: 32, mass: 0.8 },
        default: { duration: 0.5, delay: INTRO.spark, times: [0, 0.6, 1] },
      }}
      style={{ x: anchor.x }}
    >
      <g className={reduce ? "" : "map-pulse"}>
        <circle r={11} fill="url(#map-bloom)" />
        <circle r={3} className="fill-maya" filter="url(#map-glow-sm)" />
      </g>
    </motion.g>
  );
}

/** A faint guide along the circle the payments sit on. */
export function ArcGuide({ layout }: { layout: MapLayout }) {
  const span = Math.min(layout.thetaMax + layout.dTheta, Math.PI / 2);
  const a = leafPoint(-span, layout.arcC, layout.arcR);
  const b = leafPoint(span, layout.arcC, layout.arcR);
  return (
    <path
      d={`M${a.x},${a.y} A${layout.arcR},${layout.arcR} 0 0 1 ${b.x},${b.y}`}
      fill="none"
      className="stroke-hairline"
      opacity={0.6}
    />
  );
}
