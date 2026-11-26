import { describe, expect, it } from "vitest";
import { SCRAMBLE_CHARS, odometerCells, scrambleFrame } from "@/lib/motion";

describe("scrambleFrame (DESIGN.md motif 5: text scramble)", () => {
  const first = () => 0;

  it("is all noise at the start and the real text at the end, always the same length", () => {
    const start = scrambleFrame("Vault balance", 0, first);
    expect(start).toHaveLength("Vault balance".length);
    expect(start).toBe(`${SCRAMBLE_CHARS[0].repeat(5)} ${SCRAMBLE_CHARS[0].repeat(7)}`);
    expect(scrambleFrame("Vault balance", 1, first)).toBe("Vault balance");
  });

  it("settles from the left and keeps spaces, so words hold their shape", () => {
    expect(scrambleFrame("ab cd", 0.4, first)).toBe(`ab ${SCRAMBLE_CHARS[0].repeat(2)}`);
  });

  it("clamps progress outside 0..1", () => {
    expect(scrambleFrame("abc", 2, first)).toBe("abc");
    expect(scrambleFrame("abc", -1, first)).toBe(SCRAMBLE_CHARS[0].repeat(3));
  });
});

describe("odometerCells (DESIGN.md motif 6: odometer numbers)", () => {
  it("rolls digits and leaves separators still", () => {
    expect(odometerCells("1 234.50")).toEqual([
      { kind: "digit", digit: 1 },
      { kind: "char", char: " " },
      { kind: "digit", digit: 2 },
      { kind: "digit", digit: 3 },
      { kind: "digit", digit: 4 },
      { kind: "char", char: "." },
      { kind: "digit", digit: 5 },
      { kind: "digit", digit: 0 },
    ]);
  });
});
