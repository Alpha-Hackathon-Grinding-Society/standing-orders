import { describe, expect, it } from "vitest";
import type { Inflow, MoneySources } from "@/lib/data";
import {
  ITEM_PITCH,
  formatCount,
  formatEth,
  formatUtc,
  panelBox,
  paymentEnds,
  centerIndexOf,
  computeLayout,
  cometTiming,
  depth,
  drawOrder,
  fanPath,
  inflowAmount,
  inflowSource,
  leafAngle,
  leafPoint,
  mapGroups,
  offsetBounds,
  orbitMarks,
  shortAgo,
  tinyAddress,
  trunkPath,
} from "@/lib/moneyMap";
import { previewData, previewSources } from "@/lib/preview";

const DEG = Math.PI / 180;

// Canvas sizes the page really gives the map: the left column on a 1440 × 900 laptop, the full width
// on a tablet (stacked), and a phone.
const SIZES = [
  { name: "laptop column", w: 700, h: 852 },
  { name: "wide column", w: 762, h: 900 },
  { name: "tablet, stacked", w: 1000, h: 544 },
  { name: "phone", w: 340, h: 480 },
];

describe("computeLayout", () => {
  for (const { name, w, h } of SIZES) {
    it(`${name} (${w} × ${h}): every payment sits right of the anchor and inside the canvas`, () => {
      const layout = computeLayout(w, h, 3, 1);
      expect(layout.thetaMax).toBeGreaterThan(20 * DEG);
      expect(layout.thetaMax).toBeLessThanOrEqual(52 * DEG + 1e-9);
      for (const theta of [-layout.thetaMax, 0, layout.thetaMax]) {
        const p = leafPoint(theta, layout.arcC, layout.arcR);
        expect(p.x).toBeGreaterThanOrEqual(layout.anchor.x + 50 - 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(h);
        expect(p.x + 10 + layout.labelW).toBeLessThanOrEqual(w);
      }
      // Neighbouring payments are a label's height apart at the middle of the wheel.
      expect(layout.arcR * layout.dTheta).toBeCloseTo(ITEM_PITCH);
    });
  }

  it("wide canvases put the rail between the orb and the fan, and the anchor beside the picked card", () => {
    const layout = computeLayout(762, 900, 3, 2);
    expect(layout.compact).toBe(false);
    expect(layout.card.x).toBeGreaterThan(layout.R0.x + layout.orbR);
    expect(layout.anchor.x).toBe(layout.card.x + layout.card.w + 6);
    expect(layout.anchor.y).toBe(layout.cardCenters[2]);
    expect(layout.cardCenters).toEqual([366, 450, 534]);
  });

  it("phones fan straight from the orb and keep the sources out of the drawing", () => {
    const layout = computeLayout(340, 480, 3, 0);
    expect(layout.compact).toBe(true);
    expect(layout.cardCenters).toEqual([]);
    expect(layout.anchor).toEqual({ x: layout.R0.x + layout.orbR + 10, y: 240 });
  });
});

describe("the wheel", () => {
  it("leafAngle: the middle payment is level, neighbours one step apart, turning moves them all", () => {
    expect(leafAngle(5, 5, 0, 0.1)).toBe(0);
    expect(leafAngle(6, 5, 0, 0.1)).toBeCloseTo(0.1);
    expect(leafAngle(6, 5, 1, 0.1)).toBeCloseTo(0);
  });

  it("leafPoint lies on the circle", () => {
    const p = leafPoint(Math.PI / 2, { x: 10, y: 20 }, 100);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(120);
  });

  it("centre and bounds: from the first payment to the last at the middle", () => {
    expect(centerIndexOf(12)).toBe(6);
    expect(offsetBounds(12, 6)).toEqual([-6, 5]);
    expect(offsetBounds(1, 0)).toEqual([0, 0]);
    expect(offsetBounds(0, 0)).toEqual([0, 0]);
  });

  it("the newest payment opens in the readable part of the arc, not faded at its top", () => {
    const layout = computeLayout(762, 900, 3, 0);
    const center = centerIndexOf(40, layout);
    expect(center).toBeLessThan(20);
    const newest = leafAngle(0, center, 0, layout.dTheta);
    expect(depth(newest, layout.thetaMax).opacity).toBeGreaterThan(0.8);
    // A short list still sits in the middle.
    expect(centerIndexOf(3, layout)).toBe(1);
  });

  it("depth: full at the middle and to 55%, gone at the edge, shrinking towards it", () => {
    const max = 50 * DEG;
    expect(depth(0, max)).toEqual({ opacity: 1, scale: 1 });
    expect(depth(0.55 * max, max).opacity).toBeCloseTo(1);
    expect(depth(max, max)).toEqual({ opacity: 0, scale: 0.86 });
    expect(depth(-0.8 * max, max).opacity).toBeGreaterThan(0);
    expect(depth(-0.8 * max, max).opacity).toBeLessThan(1);
  });

  it("lines draw from the middle outwards", () => {
    expect([0, 1, 2, 3, 4].map((i) => drawOrder(i, 2))).toEqual([2, 1, 0, 1, 2]);
  });
});

describe("paths", () => {
  it("fanPath leaves the anchor level and arrives level at the payment", () => {
    expect(fanPath({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe("M0,0 C45,0 65,50 100,50");
  });

  it("trunkPath is the same family of curve", () => {
    expect(trunkPath({ x: 0, y: 10 }, { x: 100, y: 90 })).toBe("M0,10 C55,10 55,90 100,90");
  });
});

describe("seeded decoration", () => {
  it("orbit marks are the same on every load", () => {
    expect(orbitMarks(46)).toEqual(orbitMarks(46));
    const { ticks, dots } = orbitMarks(46);
    expect(ticks).toHaveLength(72);
    expect(dots).toHaveLength(40);
    for (const t of ticks) {
      expect(t.r2 - t.r1).toBeGreaterThanOrEqual(2);
      expect(t.r2 - t.r1).toBeLessThanOrEqual(7);
    }
  });

  it("comet timing stays in 2.4–4.2s cycles started within 3s", () => {
    for (let i = 0; i < 20; i++) {
      const { duration, delay } = cometTiming(i);
      expect(duration).toBeGreaterThanOrEqual(2.4);
      expect(duration).toBeLessThanOrEqual(4.2);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(3);
    }
  });
});

describe("labels", () => {
  const item = (over: Partial<Inflow>): Inflow => ({
    id: "0x1:0",
    from: "0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502",
    token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    symbol: "USDC",
    decimals: 6,
    amount: 100_000_000n,
    hash: "0x1",
    block: 1,
    logIndex: 0,
    at: 0,
    ...over,
  });

  it("amounts keep 2 places for USDC and 4 for 18- and 8-decimal tokens", () => {
    expect(inflowAmount(item({}), "deposits")).toBe("+100.00 USDC");
    expect(inflowAmount(item({ symbol: "WETH", decimals: 18, amount: 50_000_000_000_000_000n }), "deposits")).toBe(
      "+0.0500 WETH",
    );
    expect(inflowAmount(item({ symbol: "cbBTC", decimals: 8, amount: 200_000n }), "vesting")).toBe("+0.0020 cbBTC");
  });

  it("income is paid to the wallet, not the vault, so it carries no plus", () => {
    expect(inflowAmount(item({}), "income")).toBe("100.00 USDC");
  });

  it("sources read as a tiny address, or You for a deposit", () => {
    expect(tinyAddress("0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502")).toBe("0x1501…0502");
    expect(inflowSource("income", item({}))).toBe("0x1501…0502");
    expect(inflowSource("deposits", item({}))).toBe("You");
  });

  it("ages read in one short token", () => {
    expect([30, 300, 7_200, 3 * 86_400].map(shortAgo)).toEqual(["now", "5m", "2h", "3d"]);
  });
});

describe("mapGroups", () => {
  const now = 1_800_000_000;
  const data = previewData("active", now);

  it("three sources in rule order, each with its tokens", () => {
    const groups = mapGroups(data, previewSources("active", now));
    expect(groups.map((g) => g.key)).toEqual(["income", "vesting", "deposits"]);
    expect(groups[0].items).toHaveLength(12);
    expect(groups[0].tokens).toEqual(["USDC"]);
    expect(groups[2].tokens).toEqual(["WETH", "cbBTC", "USDC"]);
  });

  it("an empty source says why in plain words", () => {
    const none: MoneySources = { income: [], vesting: [], deposits: [], all: [] };
    const [income, vesting, deposits] = mapGroups(data, none);
    expect(income.empty).toBe("No payments yet from your 2 listed senders.");
    expect(vesting.empty).toBe("Claim and secure is off.");
    expect(deposits.empty).toBe("You have not deposited by hand yet.");
    expect(mapGroups({ ...data, rulebook: null }, none)[0].empty).toBe(
      "Could not read your listed senders on Reactive.",
    );
  });

  it("while payments are still being read, every source says so", () => {
    expect(mapGroups(data, undefined).map((g) => g.empty)).toEqual([
      "Reading payments...",
      "Reading payments...",
      "Reading payments...",
    ]);
  });
});

describe("payment panel", () => {
  it("fees read in ETH without trailing zeros, and never as a bare 0", () => {
    expect(formatEth(21_300_000_000_000n)).toBe("0.0000213 ETH");
    expect(formatEth(1_500_000_000_000_000n)).toBe("0.0015 ETH");
    expect(formatEth(3n)).toBe("<0.00000001 ETH");
    expect(formatEth(0n)).toBe("0 ETH");
  });

  it("counts and block numbers use the thin-space thousands", () => {
    expect(formatCount(34_000_000)).toBe("34 000 000");
    expect(formatCount(7n)).toBe("7");
  });

  it("block times read in UTC for every visitor", () => {
    expect(formatUtc(Date.UTC(2026, 9, 7, 14, 2) / 1000)).toBe("7 Oct 2026, 14:02 UTC");
  });

  it("beside the wheel, the panel stops short of the source cards so they stay clickable", () => {
    const layout = computeLayout(905, 780, 3, 0);
    const box = panelBox(layout);
    expect(box.beside).toBe(true);
    expect(box.left + box.width).toBeLessThanOrEqual(layout.card.x - 16);
    expect(box.width).toBeGreaterThanOrEqual(300);
    expect(box.link?.to.x).toBe(box.left + box.width);
  });

  it("without 300px left of the cards, or on a phone, the panel covers the drawing", () => {
    for (const [w, h] of [
      [800, 680],
      [340, 480],
    ]) {
      const box = panelBox(computeLayout(w, h, 3, 0));
      expect(box.beside).toBe(false);
      expect(box.width).toBe(w - 16);
      expect(box.link).toBeNull();
    }
  });

  it("each source names the two ends of a payment", () => {
    expect(paymentEnds("income")).toEqual({ from: "Paid by", to: "Paid to" });
    expect(paymentEnds("deposits")).toEqual({ from: "Deposited by", to: "Into" });
  });
});
