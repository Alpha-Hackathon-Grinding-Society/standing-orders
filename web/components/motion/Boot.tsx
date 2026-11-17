"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE_OUT } from "@/lib/motion";
import { type Network, chainName } from "@/lib/networks";
import { BootContext } from "./BootContext";
import { Scramble } from "./Scramble";

// The loop: your wallet in the middle, the chains it watches on one side, Reactive and the callback
// on the other. Wide screens draw it left to right in a 1000 × 600 box, tall ones top to bottom in
// 600 × 1000. The pulse runs wallet → origin → Rulebook → executor → vault.
type NodeKey = "wallet" | "origin" | "second" | "reactive" | "executor" | "vault";
type Layout = { w: number; h: number; nodes: Record<NodeKey, { x: number; y: number }>; labelClass: string };

const WIDE: Layout = {
  w: 1000,
  h: 600,
  nodes: {
    wallet: { x: 500, y: 300 },
    origin: { x: 210, y: 150 },
    second: { x: 210, y: 450 },
    reactive: { x: 790, y: 150 },
    executor: { x: 900, y: 300 },
    vault: { x: 790, y: 450 },
  },
  labelClass: "text-xs",
};
const TALL: Layout = {
  w: 600,
  h: 1000,
  nodes: {
    wallet: { x: 300, y: 500 },
    origin: { x: 140, y: 230 },
    second: { x: 460, y: 230 },
    reactive: { x: 140, y: 770 },
    executor: { x: 300, y: 880 },
    vault: { x: 460, y: 770 },
  },
  labelClass: "text-lg",
};

const EDGES: [NodeKey, NodeKey][] = [
  ["wallet", "origin"],
  ["wallet", "second"],
  ["origin", "reactive"],
  ["second", "vault"],
  ["wallet", "reactive"],
  ["reactive", "executor"],
  ["executor", "vault"],
  ["wallet", "vault"],
];
const PULSE: NodeKey[] = ["wallet", "origin", "reactive", "executor", "vault", "wallet"];

// The timeline, in seconds. Slow enough to read every label and follow the pulse round the loop;
// it plays once per tab, and any key or tap skips it.
const LENGTH = 7; // total, before the page shows
const LOG_START = 1.8; // first log line
const LOG_STEP = 0.7; // between log lines
const PULSE_START = 2.8;
const PULSE_LENGTH = 3.2;

/**
 * The boot sequence: a dot (your wallet), a crosshair, the reactive loop drawing itself out, a mono log
 * of what Steward is doing, then the wordmark decoding into place. Plays on top of the page, which
 * loads underneath, and calls `onDone` when it has gone.
 */
export function Boot({ network, onDone }: { network: Network; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [{ w, h, nodes: NODES, labelClass }] = useState(() => (window.innerWidth < window.innerHeight ? TALL : WIDE));
  const C = NODES.wallet;
  const second = network.watchedChains.find((id) => id !== network.base.id);

  const log = [
    `Subscribing to ${network.base.name}`,
    second ? `Watching ${chainName(second)}` : "Watching your wallet",
    `Reading your Rulebook on ${network.reactive.name}`,
    "Checking the Guardian clock",
    "Arming callbacks",
  ];
  const labels: Record<NodeKey, string> = {
    wallet: "YOU",
    origin: network.base.name.toUpperCase(),
    second: second ? chainName(second).toUpperCase() : "ORIGIN",
    reactive: "RULEBOOK",
    executor: "EXECUTOR",
    vault: "VAULT",
  };

  useEffect(() => {
    const timers = log.map((_, i) => setTimeout(() => setStep(i + 1), (LOG_START + i * LOG_STEP) * 1000));
    const end = setTimeout(() => setVisible(false), LENGTH * 1000);
    const skip = () => setVisible(false);
    window.addEventListener("keydown", skip);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
      window.removeEventListener("keydown", skip);
    };
    // The log is fixed for the life of the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible ? (
        <motion.div
          key="boot"
          role="dialog"
          aria-modal="true"
          aria-label="Starting Steward"
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center overflow-hidden bg-canvas"
          onClick={() => setVisible(false)}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(10px)" }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
            {/* crosshair */}
            <motion.line
              x1={0}
              x2={w}
              y1={C.y}
              y2={C.y}
              className="stroke-ink-faint"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              style={{ pathOffset: 0 }}
              transition={{ duration: 1.2, delay: 0.4, ease: EASE_OUT }}
            />
            <motion.line
              x1={C.x}
              x2={C.x}
              y1={0}
              y2={h}
              className="stroke-ink-faint"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.6, ease: EASE_OUT }}
            />

            {/* the loop */}
            {EDGES.map(([a, b], i) => (
              <motion.line
                key={`${a}-${b}`}
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                className="stroke-hairline"
                strokeWidth={1.2}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 1.2 + i * 0.15, ease: EASE_OUT }}
              />
            ))}

            {(Object.keys(NODES) as NodeKey[]).map((key, i) => {
              const { x, y } = NODES[key];
              const center = key === "wallet";
              const tall = h > w;
              return (
                <motion.g
                  key={key}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ originX: `${x}px`, originY: `${y}px` }}
                  transition={{ duration: 0.6, delay: center ? 0.1 : 1.6 + i * 0.12, ease: EASE_OUT }}
                >
                  <circle cx={x} cy={y} r={center ? 14 : 11} className="fill-none stroke-hairline" />
                  <circle
                    cx={x}
                    cy={y}
                    r={center ? 5 : 3.5}
                    className={center ? "fill-ink" : "fill-canvas stroke-ink"}
                  />
                  {/* wide screens label each node up and to the right; tall ones centre it underneath, so long chain names never meet */}
                  <text
                    x={tall ? x : x + 18}
                    y={tall ? y + 40 : y - 14}
                    textAnchor={tall ? "middle" : "start"}
                    className={`fill-ink-muted font-mono tracking-widest ${labelClass}`}
                  >
                    {labels[key]}
                  </text>
                </motion.g>
              );
            })}

            {/* the pulse: Maya marks what is live */}
            <motion.circle
              r={4}
              className="fill-maya"
              initial={{ opacity: 0, cx: C.x, cy: C.y }}
              animate={{
                opacity: [0, 1, 1, 1, 1, 1, 0],
                cx: PULSE.map((k) => NODES[k].x).concat(C.x),
                cy: PULSE.map((k) => NODES[k].y).concat(C.y),
              }}
              transition={{ duration: PULSE_LENGTH, delay: PULSE_START, ease: "easeInOut" }}
            />
          </svg>

          {/* the log, top left, the current line bright */}
          <ol
            aria-hidden="true"
            className="absolute top-6 left-6 flex flex-col gap-1 font-mono text-xs uppercase md:top-10 md:left-10"
          >
            {log.slice(0, step).map((line, i) => (
              <motion.li
                key={line}
                initial={{ opacity: 0, x: -8, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                className={i === step - 1 ? "text-ink" : "text-ink-muted"}
              >
                {i === step - 1 ? "> " : "  "}
                {line}
              </motion.li>
            ))}
          </ol>

          {/* the wordmark decodes in once the loop is drawn */}
          {step >= 3 ? (
            <motion.div
              aria-hidden="true"
              className="relative flex flex-col items-center gap-2 bg-canvas/70 px-6 py-3"
              initial={{ opacity: 0, filter: "blur(12px)", scale: 0.96 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              transition={{ duration: 1.1, ease: EASE_OUT }}
            >
              <span className="text-5xl font-normal text-ink md:text-display">
                {/* inside the boot itself, the scramble may run */}
                <BootContext.Provider value={true}>
                  <Scramble text="Steward" duration={1200} />
                </BootContext.Provider>
              </span>
              <span className="font-mono text-sm uppercase text-ink-muted">Money rules that run themselves</span>
            </motion.div>
          ) : null}

          {/* Focus lands here, so Enter or Space skips; any other key or a tap does too. */}
          <button
            type="button"
            autoFocus
            onClick={() => setVisible(false)}
            className="absolute right-6 bottom-6 min-h-11 cursor-pointer rounded-md px-3 font-mono text-sm uppercase text-ink-muted transition-colors duration-300 ease-reactive hover:text-white"
          >
            [ Skip ]
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
