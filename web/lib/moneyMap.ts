// The money map (DESIGN.md, Money map): where the vault's money comes from, drawn as your vault in
// the middle, a rail of sources (income, vesting, your own deposits) and a wheel of the payments
// from the source you pick. Everything here is pure: the components in components/map/ only place
// what these return, so the geometry is unit-tested without a browser.
import { zeroAddress } from "viem";
import type { Inflow, MoneySources, StewardData } from "./data";
import { formatAmount } from "./format";

export type Pt = { x: number; y: number };

export type MapLayout = {
  /** Narrow canvases (phones) put the sources in a tab row above the drawing and fan straight from the orb. */
  compact: boolean;
  w: number;
  h: number;
  /** Centre of the vault orb, its halo radius and the orb's own radius. */
  R0: Pt;
  rootR: number;
  orbR: number;
  /** Source cards: left edge, size and the vertical centre of each. Empty when compact. */
  card: { x: number; w: number; h: number };
  cardCenters: number[];
  /** Where the fan of payment lines starts: beside the picked card, or at the orb when compact. */
  anchor: Pt;
  /** The circle the payments sit on, and the x of the payment at its middle. */
  arcC: Pt;
  arcR: number;
  leafX0: number;
  /** Width of a payment's label, right of its dot. */
  labelW: number;
  /** Visible half-angle of the wheel and the angle between neighbouring payments, in radians. */
  thetaMax: number;
  dTheta: number;
};

export const COMPACT_BELOW = 560;
export const WIDE_FROM = 860;
const DEG = Math.PI / 180;
/** Vertical distance between neighbouring payments at the middle of the wheel, in px. */
export const ITEM_PITCH = 52;
const CARD_H = 60;
const CARD_PITCH = 84;
const DOT_TO_LABEL = 10;
const RIGHT_MARGIN = 16;

export const clamp = (lo: number, x: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Places everything for a canvas of `w` × `h` px with `cards` sources, the `selected` one active.
 * The wheel's visible angle is the smallest of 52°, what fits vertically, and what keeps the top and
 * bottom payments at least 50px right of the anchor, so no line ever runs backwards.
 */
export function computeLayout(w: number, h: number, cards: number, selected: number): MapLayout {
  const compact = w < COMPACT_BELOW;
  // Two thirds of a laptop screen and up: a larger orb, wider cards and labels, a longer fan.
  const big = w >= WIDE_FROM;
  const cy = h / 2;
  const orbR = compact ? 24 : big ? 40 : 32;
  const labelW = compact ? clamp(110, w * 0.4, 150) : big ? 160 : 140;
  const leafX0 = w - labelW - DOT_TO_LABEL - RIGHT_MARGIN;
  const arcR = compact ? clamp(180, h * 0.5, 320) : clamp(260, h * 0.6, 640);
  const arcC = { x: leafX0 - arcR, y: cy };

  let R0: Pt;
  let rootR: number;
  let card = { x: 0, w: 0, h: 0 };
  let cardCenters: number[] = [];
  let anchor: Pt;
  if (compact) {
    rootR = clamp(70, h * 0.2, 110);
    R0 = { x: orbR + 22, y: cy };
    anchor = { x: R0.x + orbR + 10, y: cy };
  } else {
    const cardW = big ? 176 : w >= 720 ? 156 : 132;
    const fan = clamp(120, w * 0.2, 260);
    const anchorX = leafX0 - fan;
    const railX = anchorX - 6 - cardW;
    rootR = clamp(80, Math.min(h * 0.18, w * 0.18), 170);
    R0 = { x: Math.max(orbR + 24, Math.min(w * 0.2, railX - rootR - 12)), y: cy };
    card = { x: railX, w: cardW, h: CARD_H };
    cardCenters = Array.from({ length: cards }, (_, i) => cy + (i - (cards - 1) / 2) * CARD_PITCH);
    anchor = { x: anchorX, y: cardCenters[selected] ?? cy };
  }

  const fanLength = leafX0 - anchor.x;
  const fitsAcross = Math.acos(clamp(-1, 1 - (fanLength - 50) / arcR, 1));
  const fitsDown = Math.asin(clamp(0, (cy - 28) / arcR, 1));
  const thetaMax = Math.min(52 * DEG, fitsAcross, fitsDown);

  return {
    compact,
    w,
    h,
    R0,
    rootR,
    orbR,
    card,
    cardCenters,
    anchor,
    arcC,
    arcR,
    leafX0,
    labelW,
    thetaMax,
    dTheta: ITEM_PITCH / arcR,
  };
}

/** Angle of payment `i` when the wheel is turned `offset` items (0 = the middle payment straight across). */
export function leafAngle(i: number, centerIndex: number, offset: number, dTheta: number): number {
  return (i - centerIndex - offset) * dTheta;
}

export function leafPoint(theta: number, C: Pt, R: number): Pt {
  return { x: C.x + R * Math.cos(theta), y: C.y + R * Math.sin(theta) };
}

/**
 * The payment at the middle of the wheel before it is turned. Payments are newest first, so the
 * middle is pushed up until the newest one sits in the clearly readable part of the arc (within 70%
 * of its visible angle) rather than faded at the top or off it.
 */
export function centerIndexOf(count: number, layout?: Pick<MapLayout, "thetaMax" | "dTheta">): number {
  const half = Math.floor(count / 2);
  if (!layout) return half;
  return Math.min(half, Math.floor((0.7 * layout.thetaMax) / layout.dTheta));
}

/** How far the wheel may turn, in items: from the first payment to the last at the middle. */
export function offsetBounds(count: number, centerIndex: number): [number, number] {
  return [0 - centerIndex, Math.max(0, count - 1 - centerIndex)]; // 0 - c, not -c: never a negative zero
}

/** A fan line leaves the anchor level and arrives almost level at the payment's dot. */
export function fanPath(A: Pt, L: Pt): string {
  const dx = L.x - A.x;
  return `M${r(A.x)},${r(A.y)} C${r(A.x + dx * 0.45)},${r(A.y)} ${r(L.x - dx * 0.35)},${r(L.y)} ${r(L.x)},${r(L.y)}`;
}

/** A trunk line from the orb to a source card, the same family of curve. */
export function trunkPath(P0: Pt, P3: Pt): string {
  const dx = P3.x - P0.x;
  return `M${r(P0.x)},${r(P0.y)} C${r(P0.x + dx * 0.55)},${r(P0.y)} ${r(P3.x - dx * 0.45)},${r(P3.y)} ${r(P3.x)},${r(P3.y)}`;
}

const r = (n: number) => Math.round(n * 100) / 100;

const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp(0, (x - a) / (b - a), 1);
  return t * t * (3 - 2 * t);
};

/** The wheel's depth: payments near the top and bottom fade and shrink, like a picker wheel. */
export function depth(theta: number, thetaMax: number): { opacity: number; scale: number } {
  const n = Math.abs(theta) / thetaMax;
  return { opacity: 1 - smoothstep(0.55, 1, n), scale: 1 - 0.14 * smoothstep(0.3, 1, n) };
}

/** Lines draw from the middle payment outwards: its distance from the middle, in items. */
export function drawOrder(i: number, centerIndex: number): number {
  return Math.abs(i - centerIndex);
}

/** Deterministic random numbers in [0, 1) (mulberry32), so the orbit rings look the same on every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Ring A: short radial ticks. Ring B: tiny dots with a little jitter. Together the vault's "data halo". */
export function orbitMarks(radius: number, seed = 42) {
  const rand = seeded(seed);
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const len = 2 + rand() * 5;
    return { a, r1: radius, r2: radius + len, opacity: 0.4 + rand() * 0.5 };
  });
  const dots = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2 + rand() * 0.05;
    return { a, r: radius + 6 + (rand() * 4 - 2) };
  });
  return { ticks, dots };
}

/** Per-line timing for the travelling comets: 2.4–4.2s cycles, started 0–3s apart. */
export function cometTiming(i: number): { duration: number; delay: number } {
  const rand = seeded(1000 + i);
  return { duration: 2.4 + rand() * 1.8, delay: rand() * 3 };
}

export type SourceKey = "income" | "vesting" | "deposits";

export type MapGroup = {
  key: SourceKey;
  label: string;
  /** Short ASCII mark, as the rule cards use. */
  icon: string;
  /** Payments, newest first. */
  items: Inflow[];
  /** Every token seen from this source, in order of first appearance. */
  tokens: string[];
  /** What the empty wheel says when there is nothing from this source yet. */
  empty: string;
  /** The payments could not be read; `empty` says so. */
  failed: boolean;
};

/**
 * The three sources in the order the rules run: income from listed senders (Pay yourself first),
 * vested tokens (Claim and secure), and what the owner deposits by hand.
 */
export function mapGroups(data: StewardData, sources: MoneySources | undefined, failed = false): MapGroup[] {
  const rb = data.rulebook;
  const reading = sources === undefined;
  const failedRead = reading && failed;
  const senders = rb?.incomeSenders.length ?? 0;
  const tokensOf = (items: Inflow[]) => [...new Set(items.map((item) => item.symbol))];
  const group = (key: SourceKey, label: string, icon: string, items: Inflow[], empty: string): MapGroup => ({
    key,
    label,
    icon,
    items,
    tokens: tokensOf(items),
    empty: failedRead
      ? "Could not read payments from Base. Reload the page to try again."
      : reading
        ? "Reading payments..."
        : empty,
    failed: failedRead,
  });

  return [
    group(
      "income",
      "Income",
      "$",
      sources?.income ?? [],
      !rb
        ? "Could not read your listed senders on Reactive."
        : senders === 0
          ? "No income senders listed yet."
          : `No payments yet from your ${senders === 1 ? "listed sender" : `${senders} listed senders`}.`,
    ),
    group(
      "vesting",
      "Vesting",
      "[=]",
      sources?.vesting ?? [],
      rb && rb.vesting === zeroAddress ? "Claim and secure is off." : "Nothing has vested and been claimed yet.",
    ),
    group("deposits", "Deposits", "+", sources?.deposits ?? [], "You have not deposited by hand yet."),
  ];
}

/** Every token across all sources, for the vault's footer. */
export function allTokens(groups: MapGroup[]): string[] {
  return [...new Set(groups.flatMap((g) => g.tokens))];
}

/**
 * An address short enough for a payment's label, `0x1501…0502`. The page's usual `shortAddress` is
 * too wide for the wheel; the full address is in the label's tooltip and the selected-payment line.
 */
export function tinyAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Age of a payment in one short token: `now`, `5m`, `3h`, `12d`. */
export function shortAgo(seconds: number): string {
  if (seconds < 60) return "now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/**
 * `+50.00 USDC` for what went into the vault (a claim, a deposit). Income keeps no `+`: it is paid to
 * the wallet, and Pay yourself first moves only a share of it on. Tokens with more than 6 decimals
 * (WETH, cbBTC) keep 4 places so small amounts still show.
 */
export function inflowAmount(item: Inflow, key: SourceKey): string {
  const text = formatAmount(item.amount, item.decimals, item.symbol, item.decimals > 6 ? 4 : 2);
  return key === "income" ? text : `+${text}`;
}

/** Who a payment came from, as the wheel names it. */
export function inflowSource(key: SourceKey, item: Inflow): string {
  return key === "deposits" ? "You" : tinyAddress(item.from);
}

/** A fee in ETH with up to 8 places and no trailing zeros: `0.0000213 ETH`. */
export function formatEth(wei: bigint): string {
  const text = formatAmount(wei, 18, undefined, 8).replace(/\.?0+$/, "");
  return `${text === "0" && wei > 0n ? "<0.00000001" : text} ETH`;
}

/** A whole number with the page's thin-space thousands: `34 000 000`. */
export function formatCount(n: bigint | number): string {
  return formatAmount(BigInt(n), 0, undefined, 0);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A block's time in UTC, the same for every visitor: `7 Oct 2026, 14:02 UTC`. */
export function formatUtc(seconds: number): string {
  const d = new Date(seconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/**
 * Where the payment panel sits in the canvas. Over the orb, stopping 16px short of the source cards so
 * they stay clickable, when that leaves at least 300px; otherwise (phones, narrower canvases) over the
 * whole drawing, until Close or Escape. `link` is the line from the picked payment, which the wheel
 * brings to the middle, to the panel's edge.
 */
export function panelBox(layout: MapLayout): {
  beside: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  link: { from: Pt; to: Pt } | null;
} {
  const room = layout.card.x - 32;
  if (layout.compact || room < 300) {
    return { beside: false, left: 8, top: 8, width: layout.w - 16, height: layout.h - 16, link: null };
  }
  const width = Math.min(400, room);
  const y = layout.arcC.y;
  return {
    beside: true,
    left: 16,
    top: 16,
    width,
    height: layout.h - 32,
    link: { from: { x: layout.leafX0, y }, to: { x: 16 + width, y } },
  };
}

/** How the payment panel names the two ends of a payment, by source. */
export function paymentEnds(key: SourceKey): { from: string; to: string } {
  if (key === "income") return { from: "Paid by", to: "Paid to" };
  if (key === "vesting") return { from: "Vesting", to: "Into" };
  return { from: "Deposited by", to: "Into" };
}
