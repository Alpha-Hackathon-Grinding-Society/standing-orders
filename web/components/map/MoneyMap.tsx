"use client";

import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MoneySources, StewardData } from "@/lib/data";
import { formatAgo, formatAmount, shortAddress } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import {
  type MapGroup,
  allTokens,
  centerIndexOf,
  clamp,
  computeLayout,
  drawOrder,
  inflowAmount,
  leafPoint,
  mapGroups,
  offsetBounds,
} from "@/lib/moneyMap";
import { NETWORKS, txUrl } from "@/lib/networks";
import { USDC_DECIMALS } from "@/lib/setup";
import { useBooted } from "../motion/BootContext";
import { ExternalLink, Label, StatusToken } from "../ui";
import { ArcGuide, INTRO, MapDefs, RootArt, Spark, Trunks } from "./MapArt";
import { GhostLine, type LeafEmphasis, LeafLabel, LeafLine } from "./MapWheel";

const WHEEL_SPRING = { type: "spring", stiffness: 300, damping: 34, mass: 1 } as const;
/** Payments within this many of the middle carry comets: at most 13, plus the lit trunk. */
const COMET_REACH = 6;

/**
 * Where your money comes from: your vault in the middle, a rail of sources (income from listed
 * senders, vested tokens, your own deposits), and a wheel of the payments from the picked source,
 * each with its token and amount. Turn the wheel with the mouse wheel, a drag or the arrow keys;
 * pick a payment to see its transaction below the drawing.
 */
export function MoneyMap({
  data,
  sources,
  failed,
  now,
}: {
  data: StewardData;
  sources: MoneySources | undefined;
  /** The payments could not be read. */
  failed: boolean;
  now: number;
}) {
  const network = NETWORKS[data.network];
  const groups = useMemo(() => mapGroups(data, sources, failed), [data, sources, failed]);
  const firstWithPayments = Math.max(
    0,
    groups.findIndex((g) => g.items.length > 0),
  );
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? firstWithPayments;
  const group = groups[selected];
  const items = group.items;

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const focusedIndex = items.findIndex((item) => item.id === focusedId);
  const focused = focusedIndex === -1 ? null : items[focusedIndex];

  const canvasRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const size = useSize(canvasRef);
  const reduce = useReducedMotion() ?? false;
  const booted = useBooted();
  const inView = useInView(canvasRef, { once: true, amount: 0.2 });
  const go = booted && inView;
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    if (!go) return;
    const id = setTimeout(() => setIntroDone(true), INTRO.done * 1000);
    return () => clearTimeout(id);
  }, [go]);

  const layout = useMemo(
    () => (size ? computeLayout(size.w, size.h, groups.length, selected) : null),
    [size, groups.length, selected],
  );
  const centerIndex = centerIndexOf(items.length, layout ?? undefined);

  // The wheel's turn, in items. Per-frame positions come from this motion value, never from React state.
  const wheel = useMotionValue(0);
  const target = useRef(0);
  // The payment the wheel last came to rest on, for the list's active option before one is picked.
  const [rest, setRest] = useState(0);
  const turnTo = (value: number) => {
    const [lo, hi] = offsetBounds(items.length, centerIndex);
    const next = clamp(lo, value, hi);
    target.current = next;
    setRest(Math.round(next));
    if (reduce) wheel.set(next);
    else animate(wheel, next, WHEEL_SPRING);
    return next;
  };
  // The wheel turns only when some payments are off the arc, above or below.
  const reach = layout ? Math.floor(layout.thetaMax / layout.dTheta) : Infinity;
  const turns = centerIndex > reach || items.length - 1 - centerIndex > reach;
  // Payments past the clearly readable part of the arc, above and below where the wheel rests.
  const readable = layout ? Math.floor((0.85 * layout.thetaMax) / layout.dTheta) : Infinity;
  const restAt = centerIndex + rest;
  const moreAbove = Math.max(0, restAt - readable);
  const moreBelow = Math.max(0, items.length - 1 - restAt - readable);

  const pick = (index: number) => {
    if (index === selected) return;
    setPicked(index);
    setFocusedId(null);
    setHoveredId(null);
    target.current = 0;
    setRest(0);
    wheel.set(0);
  };
  const focusLeaf = (index: number) => {
    const i = clamp(0, index, items.length - 1);
    setFocusedId(items[i].id);
    turnTo(i - centerIndex);
  };

  useWheelInput(listRef, {
    enabled: turns,
    target,
    turnTo,
    wheel,
    reduce,
    pitch: layout?.dTheta ?? 1,
    arcR: layout?.arcR ?? 1,
  });

  // Until a payment is picked, the one at the middle of the wheel is the list's active option.
  const middleIndex = clamp(0, centerIndex + rest, Math.max(0, items.length - 1));
  const onListKey = (event: KeyboardEvent) => {
    if (items.length === 0) return;
    const current = focusedIndex === -1 ? middleIndex : focusedIndex;
    const moves: Record<string, number> = {
      ArrowDown: current + (focusedIndex === -1 ? 0 : 1),
      ArrowUp: current - (focusedIndex === -1 ? 0 : 1),
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      focusLeaf(moves[event.key]);
    }
  };

  const uid = useId();
  const leafId = (i: number) => `${uid}-pay-${i}`;
  const listId = `${uid}-payments`;
  const tokens = allTokens(groups);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  // The wheel's hit area starts just left of its outermost payments, so the rest of the drawing
  // (the orb, the rail) still scrolls the page on a phone.
  const listLeft = layout ? leafPoint(layout.thetaMax, layout.arcC, layout.arcR).x - 12 : 0;
  const fanBase = introDone ? 0.05 : INTRO.fan;

  const emphasisOf = (id: string): LeafEmphasis =>
    id === focusedId ? "focus" : id === hoveredId ? "hover" : hoveredId ? "dim" : "rest";

  return (
    <section aria-labelledby="map-title" className="flex h-full flex-col gap-4">
      <Label
        id="map-title"
        right={
          sources ? (
            <span className="hidden sm:inline">
              {total} {total === 1 ? "payment" : "payments"} · {tokens.length}{" "}
              {tokens.length === 1 ? "token" : "tokens"}
            </span>
          ) : null
        }
      >
        Where your money comes from
      </Label>

      {layout?.compact ? <SourceTabs groups={groups} selected={selected} onPick={pick} controls={listId} /> : null}

      <div
        ref={canvasRef}
        className="relative h-[max(30rem,66dvh)] overflow-hidden rounded-xl select-none border border-hairline bg-canvas xl:h-auto xl:min-h-0 xl:flex-1"
      >
        {layout ? (
          <>
            <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.w} ${layout.h}`}>
              <MapDefs />
              <RootArt layout={layout} go={go} reduce={reduce} />
              {layout.compact ? null : <Trunks layout={layout} go={go} reduce={reduce} selected={selected} />}
              <ArcGuide layout={layout} />
              <AnimatePresence mode="wait">
                <motion.g key={group.key} exit={{ opacity: 0, transition: { duration: 0.26, ease: "easeIn" } }}>
                  {items.length === 0 ? (
                    go || reduce ? (
                      <GhostLine layout={layout} />
                    ) : null
                  ) : (
                    items.map((item, i) => (
                      <LeafLine
                        key={item.id}
                        i={i}
                        centerIndex={centerIndex}
                        wheel={wheel}
                        layout={layout}
                        emphasis={emphasisOf(item.id)}
                        delay={go ? fanBase + drawOrder(i, centerIndex) * INTRO.fanStep : null}
                        reduce={reduce}
                        comet={introDone && drawOrder(i, centerIndex) <= COMET_REACH}
                      />
                    ))
                  )}
                </motion.g>
              </AnimatePresence>
              <Spark layout={layout} go={go} reduce={reduce} />
            </svg>

            <VaultLabel data={data} layout={layout} tokens={tokens.length} go={go} reduce={reduce} />

            {/* Mouse cues that more payments wait off the arc; keyboard users have the arrow keys, Home and End. */}
            {moreAbove > 0 ? (
              <MoreButton
                direction="up"
                count={moreAbove}
                style={{ right: 16, top: 12 }}
                onClick={() => turnTo(rest - Math.min(moreAbove, readable))}
              />
            ) : null}
            {moreBelow > 0 ? (
              <MoreButton
                direction="down"
                count={moreBelow}
                style={{ right: 16, bottom: 12 }}
                onClick={() => turnTo(rest + Math.min(moreBelow, readable))}
              />
            ) : null}

            {layout.compact ? null : (
              <div
                role="tablist"
                aria-label="Sources"
                aria-orientation="vertical"
                className="absolute"
                style={{ left: layout.card.x, top: 0 }}
              >
                {groups.map((g, i) => (
                  <SourceCard
                    key={g.key}
                    group={g}
                    selected={i === selected}
                    controls={listId}
                    onPick={() => pick(i)}
                    onMove={pick}
                    index={i}
                    count={groups.length}
                    style={{
                      top: layout.cardCenters[i] - layout.card.h / 2,
                      width: layout.card.w,
                      height: layout.card.h,
                    }}
                    enter={{ go, reduce, delay: INTRO.cards + i * 0.07 }}
                  />
                ))}
              </div>
            )}

            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={`Payments from ${group.label.toLowerCase()}`}
              aria-activedescendant={
                items.length === 0 ? undefined : leafId(focusedIndex === -1 ? middleIndex : focusedIndex)
              }
              tabIndex={items.length > 0 ? 0 : -1}
              onKeyDown={onListKey}
              // Inside a clipped canvas, so the focus ring is drawn inside the list's edge.
              className="absolute top-0 right-0 bottom-0 rounded-lg focus-visible:-outline-offset-2"
              style={{ left: listLeft }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={group.key}
                  exit={{ opacity: 0, x: -6, transition: { duration: 0.26, ease: "easeIn" } }}
                >
                  {items.length === 0 ? (
                    <EmptyText layout={layout} left={listLeft} text={group.empty} failed={group.failed} />
                  ) : (
                    items.map((item, i) => (
                      <LeafLabel
                        key={item.id}
                        id={leafId(i)}
                        item={item}
                        source={group.key}
                        now={now}
                        left={listLeft}
                        i={i}
                        centerIndex={centerIndex}
                        wheel={wheel}
                        layout={layout}
                        emphasis={emphasisOf(item.id)}
                        delay={go ? fanBase + drawOrder(i, centerIndex) * INTRO.fanStep : null}
                        reduce={reduce}
                        onPick={() => focusLeaf(i)}
                        onHover={(hovering) => setHoveredId(hovering ? item.id : null)}
                      />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : null}
      </div>

      <p aria-live="polite" className="min-h-11 text-sm text-ink-muted">
        {focused ? (
          <>
            <span className="font-mono text-ink">{inflowAmount(focused, group.key)}</span>{" "}
            {group.key === "deposits"
              ? "deposited by you"
              : group.key === "vesting"
                ? `claimed from ${shortAddress(focused.from)}`
                : `paid to you by ${shortAddress(focused.from)}`}
            {focused.at > 0 ? `, ${formatAgo(now - focused.at)}` : ""}.{" "}
            {group.key === "income" && data.rulebook
              ? `Pay yourself first saves ${data.rulebook.splitBps / 100}% of income, within your cap. `
              : ""}
            <ExternalLink href={txUrl(network.baseExplorer, focused.hash)}>{shortAddress(focused.hash)}</ExternalLink>
          </>
        ) : items.length > 0 ? (
          "Pick a payment to see its transaction. Scroll, drag, tap or use the arrow keys to turn the wheel."
        ) : null}
      </p>
    </section>
  );
}

/** The vault's name and balance above the orb, the tokens it has received below. */
function VaultLabel({
  data,
  layout,
  tokens,
  go,
  reduce,
}: {
  data: StewardData;
  layout: NonNullable<ReturnType<typeof computeLayout>>;
  tokens: number;
  go: boolean;
  reduce: boolean;
}) {
  const { R0, orbR, compact } = layout;
  const shown = go || reduce;
  const fade = {
    initial: reduce ? false : { opacity: 0, y: 8 },
    animate: { opacity: shown ? 1 : 0, y: shown ? 0 : 8 },
    transition: { duration: 0.4, delay: 0.38, ease: EASE_OUT },
  } as const;
  return (
    <>
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{ left: R0.x - orbR, top: R0.y - orbR, width: orbR * 2, height: orbR * 2 }}
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: shown ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8, delay: 0.22 }}
      >
        <div className={`map-orb h-full w-full rounded-full ${reduce ? "" : "map-breathe"}`} />
      </motion.div>
      <motion.div
        {...fade}
        className={`absolute flex flex-col text-center ${compact ? "items-start" : "items-center"}`}
        style={
          compact
            ? { left: 12, top: R0.y + orbR + 18 }
            : { left: R0.x, top: R0.y - orbR - 30, translateX: "-50%", translateY: "-100%" }
        }
      >
        <span className="font-mono text-xs uppercase text-ink-muted">Your vault</span>
        <span className="text-lg tabular-nums text-ink">
          {formatAmount(data.vaultBalance, USDC_DECIMALS)} <span className="font-mono text-sm text-ink-mono">USDC</span>
        </span>
      </motion.div>
      {compact ? null : (
        <motion.span
          {...fade}
          className="absolute rounded-full border border-hairline bg-surface-raised px-2 font-mono text-xs uppercase leading-5 text-ink-mono"
          style={{ left: R0.x, top: R0.y + orbR + 28, translateX: "-50%" }}
        >
          {tokens === 0 ? "No payments yet" : `${tokens} ${tokens === 1 ? "token" : "tokens"} in`}
        </motion.span>
      )}
    </>
  );
}

/** One source on the rail: its mark, how many payments, its tokens and its name. A tab of the wheel. */
function SourceCard({
  group,
  selected,
  controls,
  onPick,
  onMove,
  index,
  count,
  style,
  enter,
}: {
  group: MapGroup;
  selected: boolean;
  /** The id of the payment list this tab shows. */
  controls: string;
  onPick: () => void;
  onMove: (next: number) => void;
  index: number;
  count: number;
  style: React.CSSProperties;
  enter: { go: boolean; reduce: boolean; delay: number };
}) {
  const shown = enter.go || enter.reduce;
  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onPick}
      onKeyDown={(event) => tabKeys(event, index, count, "vertical", onMove)}
      className={`group absolute left-0 flex cursor-pointer flex-col justify-center gap-0.5 rounded-md border bg-surface px-3 text-left transition-[background-color,border-color,translate] duration-150 ease-settle hover:translate-x-0.5 hover:bg-surface-raised ${
        selected ? "border-transparent" : "border-hairline hover:border-ink-faint"
      }`}
      style={style}
      initial={enter.reduce ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : -16 }}
      transition={{ duration: 0.42, delay: enter.delay, ease: EASE_OUT }}
    >
      {selected ? (
        <motion.span
          layoutId="map-card-ring"
          aria-hidden="true"
          className="map-card-ring pointer-events-none absolute inset-0 rounded-md border border-maya"
          transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8 }}
        />
      ) : null}
      <CardBody group={group} selected={selected} />
    </motion.button>
  );
}

function CardBody({ group, selected, compact = false }: { group: MapGroup; selected: boolean; compact?: boolean }) {
  const tokens = group.tokens.length > 2 ? `${group.tokens.length} tokens` : group.tokens.join(" · ");
  return (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span aria-hidden="true" className="font-mono text-sm text-ink-muted">
            {group.icon}
          </span>
          <span className={`text-xl tabular-nums ${selected ? "text-ink" : "text-ink-default"}`}>
            {group.items.length}
          </span>
        </span>
        {compact ? null : <span className="truncate font-mono text-xs uppercase text-ink-muted">{tokens}</span>}
      </span>
      <span className={`text-sm ${selected ? "text-ink" : "text-ink-secondary"}`}>{group.label}</span>
    </>
  );
}

/** Phones: the sources as a row of tabs above the drawing. */
function SourceTabs({
  groups,
  selected,
  onPick,
  controls,
}: {
  groups: MapGroup[];
  selected: number;
  onPick: (i: number) => void;
  controls: string;
}) {
  return (
    <div role="tablist" aria-label="Sources" className="grid grid-cols-3 gap-2">
      {groups.map((g, i) => (
        <button
          key={g.key}
          type="button"
          role="tab"
          aria-selected={i === selected}
          aria-controls={controls}
          tabIndex={i === selected ? 0 : -1}
          onClick={() => onPick(i)}
          onKeyDown={(event) => tabKeys(event, i, groups.length, "horizontal", onPick)}
          className={`relative flex min-h-11 cursor-pointer flex-col justify-center gap-0.5 rounded-md border bg-surface px-3 py-2 text-left transition-colors duration-150 ${
            i === selected ? "border-transparent" : "border-hairline"
          }`}
        >
          {i === selected ? (
            <motion.span
              layoutId="map-tab-ring"
              aria-hidden="true"
              className="map-card-ring pointer-events-none absolute inset-0 rounded-md border border-maya"
              transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8 }}
            />
          ) : null}
          <CardBody group={g} selected={i === selected} compact />
        </button>
      ))}
    </div>
  );
}

/** `MORE ↓ 4`: turns the wheel towards payments that are off the arc. */
function MoreButton({
  direction,
  count,
  style,
  onClick,
}: {
  direction: "up" | "down";
  count: number;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClick}
      className="absolute z-10 min-h-11 cursor-pointer rounded-md px-3 font-mono text-xs uppercase text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
      style={style}
    >
      More {direction === "up" ? "↑" : "↓"} {count}
    </button>
  );
}

/** What an empty source says, beside the dashed line, as readable HTML. */
function EmptyText({
  layout,
  left,
  text,
  failed,
}: {
  layout: NonNullable<ReturnType<typeof computeLayout>>;
  left: number;
  text: string;
  failed: boolean;
}) {
  const point = leafPoint(0, layout.arcC, layout.arcR);
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="absolute -translate-y-1/2 text-sm text-ink-muted"
      style={{ left: point.x + 10 - left, top: point.y, width: layout.labelW }}
    >
      {failed ? (
        <>
          <StatusToken symbol="(x)" word="FAILED" tone="danger" /> <span aria-hidden="true">·</span>{" "}
        </>
      ) : null}
      {text}
    </motion.p>
  );
}

/**
 * Arrow keys move between source tabs (down and up on the rail, right and left on phones); Home and
 * End jump to the first and last. The newly picked tab takes focus, as tabs with automatic activation do.
 */
function tabKeys(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  count: number,
  orientation: "vertical" | "horizontal",
  onMove: (next: number) => void,
) {
  const [back, forward] = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  const keys: Record<string, number> = {
    [forward]: (index + 1) % count,
    [back]: (index - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  if (!(event.key in keys)) return;
  event.preventDefault();
  const next = keys[event.key];
  onMove(next);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

/** The canvas's size in px, ignoring transforms (entrances scale it), updated as it resizes. */
function useSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize((s) =>
        s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * Mouse wheel and a mouse or pen drag turn the payment wheel; at either end the mouse wheel scrolls
 * the page as normal. A drag throws the wheel on with its speed, then snaps to a payment. Touch is
 * left to the page, so a finger on the drawing always scrolls: on phones a payment comes to the
 * middle when tapped.
 */
function useWheelInput(
  ref: RefObject<HTMLDivElement | null>,
  {
    enabled,
    target,
    turnTo,
    wheel,
    reduce,
    pitch,
    arcR,
  }: {
    enabled: boolean;
    target: RefObject<number>;
    turnTo: (value: number) => number;
    wheel: ReturnType<typeof useMotionValue<number>>;
    reduce: boolean;
    pitch: number;
    arcR: number;
  },
) {
  const turn = useRef(turnTo);
  useLayoutEffect(() => {
    turn.current = turnTo;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let snap: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      const before = target.current;
      const next = turn.current(before + event.deltaY / 100);
      if (next === before) return; // at an end: the page scrolls instead
      event.preventDefault();
      clearTimeout(snap);
      snap = setTimeout(() => turn.current(Math.round(target.current)), 140);
    };

    const itemPx = pitch * arcR;
    let start: { y: number; offset: number; moved: boolean } | null = null;
    let swallowClick = false;
    const onDown = (event: PointerEvent) => {
      swallowClick = false;
      if (event.pointerType === "touch" || event.button !== 0) return;
      start = { y: event.clientY, offset: wheel.get(), moved: false };
    };
    const onMove = (event: PointerEvent) => {
      if (!start) return;
      if (event.buttons === 0) {
        start = null; // released somewhere this list did not hear about
        return;
      }
      const dy = event.clientY - start.y;
      if (!start.moved && Math.abs(dy) < 4) return;
      if (!start.moved) {
        wheel.stop();
        el.setPointerCapture(event.pointerId);
      }
      start.moved = true;
      wheel.set(start.offset - dy / itemPx);
      target.current = wheel.get();
    };
    const onUp = () => {
      if (!start) return;
      const moved = start.moved;
      start = null;
      if (!moved) return;
      swallowClick = true; // the click that ends a drag is not a pick
      const thrown = wheel.get() + (reduce ? 0 : wheel.getVelocity() * 0.18);
      turn.current(Math.round(thrown));
    };
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("lostpointercapture", onUp);
    el.addEventListener("click", onClick, { capture: true });
    return () => {
      clearTimeout(snap);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("lostpointercapture", onUp);
      el.removeEventListener("click", onClick, { capture: true });
    };
  }, [ref, enabled, target, wheel, reduce, pitch, arcR]);
}
