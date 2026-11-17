import { defineConfig, devices } from "@playwright/test";

// Smoke test against the production build: `pnpm build && pnpm test:e2e`.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  // The smoke test checks states, not timing, so it runs with reduced motion: no boot sequence, no
  // entrances, plain numbers. tests/e2e/motion.spec.ts turns motion back on to check the animations.
  use: { baseURL: "http://127.0.0.1:3000", reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm start -p 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
