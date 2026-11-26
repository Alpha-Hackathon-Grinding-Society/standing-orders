import { defineConfig, devices } from "@playwright/test";

// Smoke test against the production build: `pnpm build && pnpm test:e2e`.
// E2E_PORT picks another port when something else (say a LAN preview) already holds 3000.
const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  // The smoke test checks states, not timing, so it runs with reduced motion: no boot sequence, no
  // entrances, plain numbers. tests/e2e/motion.spec.ts turns motion back on to check the animations.
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm start -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
