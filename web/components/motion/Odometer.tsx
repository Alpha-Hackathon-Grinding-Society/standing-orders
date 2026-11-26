"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { odometerCells } from "@/lib/motion";
import { useBooted } from "./BootContext";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A number whose digits roll into place like an odometer (DESIGN.md motif 6): from 0 on first view,
 * then from the old digit to the new one whenever the value changes. Screen readers get the text only.
 */
export function Odometer({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const booted = useBooted();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  if (reduce) return <>{text}</>;

  const live = inView && booted;
  const cells = odometerCells(text);
  return (
    <span ref={ref} className="inline-flex">
      {/* Browsers without the `lh` unit show the plain number instead (globals.css). */}
      <span aria-hidden="true" className="odo-plain hidden">
        {text}
      </span>
      <span aria-hidden="true" className="odo-roll inline-flex">
        {cells.map((cell, i) =>
          cell.kind === "char" ? (
            <span key={i}>{cell.char}</span>
          ) : (
            <span key={i} className="inline-block h-[1lh] overflow-hidden">
              <span
                className="flex flex-col transition-transform duration-900 ease-settle"
                style={{
                  transform: `translateY(${-(live ? cell.digit : 0) * 10}%)`,
                  transitionDelay: `${(cells.length - i) * 35}ms`,
                }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="h-[1lh]">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          ),
        )}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
