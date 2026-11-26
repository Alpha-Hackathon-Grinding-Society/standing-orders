"use client";

import { type MotionValue, useMotionValue } from "motion/react";
import { useLayoutEffect } from "react";
import { type MapLayout, depth, fanPath, leafAngle, leafPoint } from "@/lib/moneyMap";

/** Below this depth a payment is too faint to point at, so it stops taking clicks. */
const CLICKABLE = 0.25;

/**
 * Where payment `i` sits as the wheel turns, as motion values: its dot, its depth fade and scale, and
 * the fan line to it. Updated on every wheel change without a React render (DESIGN.md, Money map).
 */
export function useLeafMotion(wheel: MotionValue<number>, i: number, centerIndex: number, layout: MapLayout) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const scale = useMotionValue(1);
  const d = useMotionValue("");
  const pointerEvents = useMotionValue<"auto" | "none">("none");

  useLayoutEffect(() => {
    const update = (offset: number) => {
      const theta = leafAngle(i, centerIndex, offset, layout.dTheta);
      const point = leafPoint(theta, layout.arcC, layout.arcR);
      const fade = depth(theta, layout.thetaMax);
      x.set(point.x);
      y.set(point.y);
      opacity.set(fade.opacity);
      scale.set(fade.scale);
      d.set(fanPath(layout.anchor, point));
      pointerEvents.set(fade.opacity < CLICKABLE ? "none" : "auto");
    };
    update(wheel.get());
    return wheel.on("change", update);
  }, [wheel, i, centerIndex, layout, x, y, opacity, scale, d, pointerEvents]);

  return { x, y, opacity, scale, d, pointerEvents };
}
