import { expect, test } from "@playwright/test";

// The page in every Guardian state and with no vault, using the labelled preview data in place of
// chain reads (lib/preview.ts). Screenshots go to test-results/ for review.

test("without a wallet, the page invites a connection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "[ Connect wallet ]" })).toBeVisible();
  await expect(page.getByText("Connect your wallet to see your vault")).toBeVisible();
  await expect(page.getByRole("link", { name: /Built on Reactive/ })).toBeVisible();
});

test("Active: vault balance, green state, countdown to warning and I'm alive", async ({ page }, info) => {
  await page.goto("/?preview=active");
  await expect(page.getByRole("alert").getByText("[!] PREVIEW")).toBeVisible();
  const vault = page.getByRole("region", { name: "// Vault balance" });
  await expect(vault.getByText("145.50", { exact: true })).toBeVisible();
  await expect(page.getByText("(v) ACTIVE")).toBeVisible();
  // 87 days left at first render; the countdown ticks, so a second later it reads 86d 23h.
  await expect(page.getByText(/^8[67]d \d\dh until warning$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "[ I'm alive ]" })).toBeVisible();
  for (const title of ["Pay yourself first", "Claim and secure", "Guardian"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "[ Pause all ]" })).toBeVisible();
  await expect(page.getByRole("button", { name: "[ Withdraw ]" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Summary" }).locator("dl > div")).toHaveCount(4);
  await expect(page.getByText("41 days", { exact: true })).toBeVisible();
  await expect(page.getByText("from Pay yourself first")).toBeVisible();
  const recent = page.getByRole("region", { name: "// Recent automatic actions" });
  await expect(recent.getByRole("listitem")).toHaveCount(3);
  await expect(recent.getByText("+20.00 USDC")).toBeVisible();
  await page.screenshot({ path: info.outputPath("active.png"), fullPage: true });
});

test("Phones: a floating pill jumps between sections", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?preview=active");
  const nav = page.getByRole("navigation", { name: "Sections" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Controls" }).click();
  await expect(page).toHaveURL(/#controls-title$/);
  await page.screenshot({ path: info.outputPath("phone.png") });
});

test("Warning: amber state and a countdown to release", async ({ page }, info) => {
  await page.goto("/?preview=warning");
  await expect(page.getByText("[!] WARNING")).toBeVisible();
  await expect(page.getByText(/until release$/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("warning.png"), fullPage: true });
});

test("Released: final state, no I'm alive", async ({ page }, info) => {
  await page.goto("/?preview=released");
  await expect(page.getByText("(v) RELEASED")).toBeVisible();
  await expect(page.getByRole("button", { name: "[ I'm alive ]" })).toHaveCount(0);
  await expect(page.getByText("all to beneficiary")).toBeVisible();
  await page.screenshot({ path: info.outputPath("released.png"), fullPage: true });
});

test("Paused: rules show PAUSED and Unpause replaces Pause all", async ({ page }) => {
  await page.goto("/?preview=paused");
  await expect(page.getByRole("region", { name: "// Controls" }).getByText("[!] PAUSED")).toBeVisible();
  await expect(page.getByRole("region", { name: "// The loop" }).getByText("[!] PAUSED")).toBeVisible();
  // Pay yourself first and Guardian are on, so they read PAUSED; Claim and secure is off in this sample.
  await expect(page.getByText("[ PAUSED ]")).toHaveCount(2);
  await expect(page.getByText("[ OFF ]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "[ Unpause ]" })).toBeVisible();
});

test("Low REACT: amber banner", async ({ page }) => {
  await page.goto("/?preview=lowreact");
  await expect(page.getByText("[!] LOW REACT")).toBeVisible();
});

test("No vault: empty state offers setup", async ({ page }, info) => {
  await page.goto("/?preview=novault");
  await expect(page.getByText("This wallet has no Steward vault")).toBeVisible();
  await expect(page.getByRole("button", { name: "[ Set up your rules ]" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("novault.png"), fullPage: true });
});

test("Setup: rule fields, blur-first validation and a plain-English review", async ({ page }, info) => {
  await page.goto("/?preview=novault");
  await page.getByRole("button", { name: "[ Set up your rules ]" }).click();
  await expect(page.getByRole("heading", { name: "// Set up your rules" })).toBeVisible();

  const senders = page.getByLabel("Addresses that pay you");
  await senders.fill("0x123");
  await senders.blur();
  await expect(page.getByText("Use full 0x addresses, separated by commas or new lines.")).toBeVisible();
  await senders.fill("0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502");
  await expect(page.getByText("Use full 0x addresses")).toHaveCount(0);

  await page.getByLabel("Beneficiary").fill("0x810fCBF8A695Ffa0e4480207c667995139F33276");
  const review = page.getByRole("region", { name: "// Review" });
  await expect(
    review.getByText(/^Pay yourself first: save 20% of every USDC payment from 0x1501D3\.\.\.9Cfb0502/),
  ).toBeVisible();
  await expect(review.getByText(/^Guardian: if you are silent for 90 days/)).toBeVisible();
  await expect(page.getByRole("button", { name: "[ Sign setup ]" })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("setup.png"), fullPage: true });
});
