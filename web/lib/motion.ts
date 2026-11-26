// Pure helpers behind the page's motion (DESIGN.md, Motion): the text scramble, the odometer and the
// shared easing. The components in components/motion/ only render what these return, and every
// one of them shows the final state at once when the visitor prefers reduced motion.

/** Entrances: fast out, long settle. Same curve as `--ease-settle` in globals.css; keep them in step. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Characters a scrambling headline cycles through before it settles: terminal punctuation, no letters. */
export const SCRAMBLE_CHARS = "!<>-_\\/[]{}=+*^?#01";

/**
 * One frame of the text scramble (DESIGN.md motif 5): the first `progress` share of the text is
 * settled, the rest is noise of the same length. Spaces stay spaces so the words keep their shape.
 * `rand` returns a number in [0, 1); pass a fixed one in tests.
 */
export function scrambleFrame(text: string, progress: number, rand: () => number = Math.random): string {
  const settled = Math.floor(Math.max(0, Math.min(1, progress)) * text.length);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (i < settled || ch === " ") out += ch;
    else out += SCRAMBLE_CHARS[Math.floor(rand() * SCRAMBLE_CHARS.length) % SCRAMBLE_CHARS.length];
  }
  return out;
}

export type OdometerCell = { kind: "digit"; digit: number } | { kind: "char"; char: string };

/** Splits a formatted number into cells: digits roll, everything else (`.`, thin spaces, units) stands still. */
export function odometerCells(text: string): OdometerCell[] {
  return [...text].map((char) =>
    char >= "0" && char <= "9" ? { kind: "digit", digit: Number(char) } : { kind: "char", char },
  );
}

/** Once per browser tab: the boot sequence plays on the first visit of a session only. */
export const BOOT_KEY = "steward-booted";
