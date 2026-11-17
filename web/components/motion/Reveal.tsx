"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { type ReactNode, useRef } from "react";
import { EASE_OUT } from "@/lib/motion";
import { useBooted } from "./BootContext";

const hidden = { opacity: 0, y: 28, rotateX: -7, scale: 0.97, filter: "blur(8px)" };
// Once settled, drop the filter: a lingering `blur(0px)` keeps every card on its own layer.
const shown = { opacity: 1, y: 0, rotateX: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } };

/**
 * A card's entrance: it rises out of blur with a slight tilt the first time it scrolls into view,
 * `order` steps of 80ms after its neighbours. A plain block when reduced motion is preferred.
 */
export function Reveal({
  children,
  order = 0,
  className,
}: {
  children: ReactNode;
  order?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const booted = useBooted();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      className={className}
      // Perspective only while there is a transform to show. A settled card has none at all, so it
      // never becomes the containing block for something fixed inside it, such as a popover.
      transformTemplate={(_, generated) => (generated ? `perspective(1200px) ${generated}` : "none")}
      initial={hidden}
      animate={inView && booted ? shown : hidden}
      transition={{ duration: 0.75, ease: EASE_OUT, delay: order * 0.08 }}
    >
      {children}
    </motion.div>
  );
}
