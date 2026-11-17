import { expect, test } from "@playwright/test";

// The page with motion on, as most visitors see it (DESIGN.md, Motion).
test.use({ reducedMotion: "no-preference" });

test("the boot sequence plays once per tab, can be skipped, and leaves a working page", async ({ page }, info) => {
  await page.goto("/?preview=active");
  const boot = page.getByRole("dialog", { name: "Starting Steward" });
  await expect(boot).toBeVisible();
  // Focus starts on Skip, so a keyboard user can leave straight away.
  await expect(boot.getByRole("button", { name: "[ Skip ]" })).toBeFocused();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath("boot.png") });
  // Any key skips; on a slow machine the sequence may already have ended, which is fine too.
  await page.keyboard.press("Escape");
  await expect(boot).toHaveCount(0);

  // Labels decode into their real names on screen (not only for screen readers), and the loop is live.
  await expect(page.getByRole("heading", { name: "// Vault balance" })).toBeVisible();
  await expect(page.locator('#vault-title > span > span[aria-hidden="true"]')).toHaveText("Vault balance");
  const loop = page.getByRole("region", { name: "// The loop" });
  await expect(loop.getByText(">> LIVE")).toBeVisible();
  await expect(page.getByRole("button", { name: "[ I'm alive ]" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath("dashboard.png"), fullPage: true });

  // Not again in the same tab.
  await page.reload();
  await expect(page.getByRole("heading", { name: "// Vault balance" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Starting Steward" })).toHaveCount(0);
});

test("a paused loop holds still and says why", async ({ page }) => {
  await page.goto("/?preview=paused");
  await expect(page.getByRole("dialog", { name: "Starting Steward" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Starting Steward" })).toHaveCount(0);
  const loop = page.getByRole("region", { name: "// The loop" });
  await expect(loop.getByText("[!] PAUSED")).toBeVisible();
  await expect(loop.locator("ol")).toHaveClass(/loop-stalled/);
});
