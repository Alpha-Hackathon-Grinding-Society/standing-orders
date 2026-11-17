"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { scrambleFrame } from "@/lib/motion";
import { useBooted } from "./BootContext";

/**
 * Text that decodes from noise into itself over ~600ms the first time it scrolls into view
 * (DESIGN.md motif 5). Screen readers get the real text only; the noise is hidden from them.
 */
export function Scramble({ text, duration = 600 }: { text: string; duration?: number }) {
  const reduce = useReducedMotion();
  const booted = useBooted();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (reduce || !inView || !booted) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = (now - start) / duration;
      setShown(progress >= 1 ? null : scrambleFrame(text, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, inView, booted, text, duration]);

  if (reduce) return <>{text}</>;
  return (
    <span ref={ref}>
      <span aria-hidden="true">{shown ?? (inView && booted ? text : scrambleFrame(text, 0, () => 0.5))}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
