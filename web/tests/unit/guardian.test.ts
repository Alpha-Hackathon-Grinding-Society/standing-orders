import { describe, expect, it } from "vitest";
import { type GuardianInput, guardianView } from "@/lib/guardian";

const DAY = 86_400;
const now = 1_800_000_000;
const active: GuardianInput = {
  state: 0,
  now,
  lastActiveAny: now - 3 * DAY,
  warningSince: 0,
  silencePeriod: 90 * DAY,
  gracePeriod: 14 * DAY,
  guardianCheckInterval: 3_600,
  paused: false,
};

describe("guardianView (G-2, G-3 state mapping)", () => {
  it("Active counts down to the warning, in green with a symbol", () => {
    const v = guardianView(active);
    expect([v.symbol, v.word, v.tone]).toEqual(["(v)", "ACTIVE", "success"]);
    expect(v.countdown).toBe("87d 00h until warning");
    expect(v.nextAt).toBe(now + 87 * DAY);
  });

  it("Active past the silence period says the warning comes at the next check", () => {
    expect(guardianView({ ...active, lastActiveAny: now - 91 * DAY }).countdown).toBe("warning at the next check");
  });

  it("Warning counts down to the release, in amber", () => {
    const v = guardianView({ ...active, state: 1, warningSince: now - 2 * DAY });
    expect([v.symbol, v.word, v.tone]).toEqual(["[!]", "WARNING", "warning"]);
    expect(v.countdown).toBe("12d 00h until release");
  });

  it("Warning while paused explains the release waits", () => {
    const v = guardianView({ ...active, state: 1, warningSince: now - 20 * DAY, paused: true });
    expect(v.countdown).toBe("release waiting");
    expect(v.detail).toMatch(/paused/);
  });

  it("Released is final, in Quartz, with no countdown", () => {
    const v = guardianView({ ...active, state: 2 });
    expect([v.symbol, v.word, v.tone, v.nextAt]).toEqual(["(v)", "RELEASED", "quartz", null]);
  });

  it("A zero silence period means the Guardian is off", () => {
    const v = guardianView({ ...active, silencePeriod: 0 });
    expect(v.word).toBe("OFF");
    expect(v.nextAt).toBeNull();
  });
});
