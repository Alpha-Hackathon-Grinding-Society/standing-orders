# Demo video: script and click path

Target: **under 3 minutes**, screen recording with a voice-over. Six scenes, timed to the shot list in `CLAUDE.md` (Phase 7). Each scene lists what to show, the exact clicks or commands, and one or two lines to say. Live steps that take minutes, like the Guardian's silence and grace, are recorded in full and cut down in the edit.

Every scene also has a **fallback**: hashes already on-chain from earlier runs. If a live step fails on the day, show the fallback explorer tab instead. The video is still honest, because those transactions are real.

## Before recording

**Wallets and funds** (testnet only; no mainnet transaction is needed for the video):

| Wallet | Used for | Needs | Has now (2026-11-26) |
| --- | --- | --- | --- |
| A fresh browser-wallet account, with no vault yet | Scene 2, setup from the page | ≈ 0.005 Base Sepolia ETH, ≈ 0.6 lREACT | nothing yet |
| PC wallet `0x1501…0502` (`.env`) | Scene 3 payment (it is the listed sender); Scene 4 `make e2e-phase3` | ≈ 0.01 Base Sepolia ETH, ≈ 1.7 lREACT, a little Unichain Sepolia ETH | 0.0119 ETH, **0.44 lREACT** (short), 0.005 Unichain ETH |

Short by about 2 lREACT in total. To fix it, get **≈ 0.05 Base Sepolia ETH** from a public faucet into the PC wallet. Then send 0.03 of it to Reactive's faucet `0x2afaFD298b23b62760711756088F75B7409f5967` on Base Sepolia, which returns about 3 lREACT on Lasna. Send 0.6 lREACT of that, plus a little Base Sepolia ETH, to the fresh account.

**Why a fresh account:** the factory allows one vault per owner (F-2), so a wallet that already has a testnet vault opens its dashboard instead of the setup flow.

**Screen:** browser at 1440 px wide, zoom 100%, dark OS theme. Open these tabs in order:

1. https://steward-reactive.vercel.app/ (Testnet selected, fresh account connected)
2. https://sepolia.basescan.org/ (for the payment and callback)
3. https://lasna.reactscan.net/ (for the Reactive transactions)
4. https://steward-reactive.vercel.app/?watch=0x810fCBF8A695Ffa0e4480207c667995139F33276&net=mainnet (Scene 5: the real vault, read-only, no wallet needed)
5. https://reactscan.net/address/0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a (the mainnet Rulebook)

**Terminal:** repo root, `.env` loaded, font large enough to read in the video (≥ 18 pt).

## Scene 1: the problem (0:00–0:20)

**Show:** the page's boot animation, then the money map on the `?preview=active` dashboard.

**Say:** "Good money habits fail because they need you to act every time. Save a share of each paycheck. Claim your vested tokens. Make sure your savings reach someone you trust if something happens to you. Steward turns those into rules that run themselves, on-chain, with no bot and no server."

## Scene 2: setup from the page (0:20–0:40)

**Click path** (tab 1, fresh account):

1. `[ SET UP YOUR RULES ]`.
2. Pay yourself first: 20%. *Who pays you*: `0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502`. Cap 25 USDC per 30 days, budget 100.
3. Guardian on: 90 days of silence, 14 days of grace. Beneficiary: any second address.
4. Read the `// REVIEW` panel aloud in one breath. Press sign.
5. Sign the permit and `createVault` on Base Sepolia. The page switches to Lasna: sign the Rulebook deploy (0.5 lREACT attached). Hold on the rows turning from `(~) PENDING` to `(v) SUCCESS`.

**Say:** "Setup is one page. I sign twice on Base: a capped USDC permit and my vault. Then once on Reactive, to deploy my own Rulebook. That contract makes every decision from now on."

**Fallback:** the Phase 5 page setup in `docs/TX_HASHES.md` ("a vault set up end to end from the page").

## Scene 3: a payment splits, and a vesting claim lands (0:40–1:20)

**Command** (terminal; the PC wallet is the listed sender, `TO_ADDRESS` is the fresh account):

```bash
make pay-test-usdc TO_ADDRESS=<fresh account> PAY_AMOUNT=100
```

**Show:** the payment on Base Sepolia (tab 2), the Rulebook's `SplitRequested` on Lasna (tab 3), the callback's `SplitExecuted` on Base Sepolia, then the page: the vault card shows **20 USDC** and the money map gains a payment. The whole loop takes about 2 seconds.

**Then the claim** (recorded during Scene 4's script run, which claims from a real OpenZeppelin `VestingWallet` on a cron tick): show the Lasna `ClaimRequested` and the Base Sepolia `ClaimExecuted`.

**Say:** "Someone on my list pays me 100 USDC. Within two seconds my Rulebook on Reactive sees it, takes 20%, and the executor moves 20 USDC into my vault. No one pressed anything. Claims work the same way on a schedule: vested tokens are released and moved into the vault."

**Fallback:** README testnet rows "Rule 1 split" (`0x36a4…` → `0xda7a…` → `0x5dfc…`) and "Rule 2 claim" (`0x4a62…` → `0xabf2…`).

## Scene 4: the Guardian, across two chains (1:20–2:15)

**Command** (start it about 15 minutes before recording this scene; it prints every hash as it goes):

```bash
BENEFICIARY=<any address> make e2e-phase3
```

It deploys a demo Rulebook with short timers: 3 minutes of silence, 2 minutes of grace, a check every 30 seconds on `Cron10`. Then it runs claim, Warning, clear from Unichain, Warning, grace, and release, in about 12 minutes and for about 0.8 lREACT.

**Show, cut to the moments:**

1. Lasna: `GuardianWarning` after the silence.
2. A transfer signed on **Unichain Sepolia** (sepolia.uniscan.xyz), then Lasna `GuardianCleared`, which names that Unichain transaction.
3. Silence again: `GuardianWarning`, then after the grace period, `GuardianReleased`. On Base Sepolia, `VaultReleased` and the beneficiary's balance.

**Say:** "The Guardian watches for my signed activity on every chain I use. If I go quiet, it warns first. Any activity, even on another chain, clears the warning. Only after a full grace period of silence does the vault go to my beneficiary. Never in one step."

**Fallback:** README rows "Guardian warning", "Guardian cleared by activity on a second chain" and "Guardian release" (Run B, 2026-11-16).

## Scene 5: it runs on mainnet, with real money (2:15–2:45)

**Show:** tab 4, the real dashboard on Base mainnet through the watch link: vault balance, Guardian `(v) ACTIVE` with its countdown, the money map's real payments. Point at the `>> WATCHING` note: anyone can open this link. Then run the checker in the terminal and let the summary scroll:

```bash
node scripts/check-live.mjs --mainnet
```

Hold on `The mainnet vault right now` and `All checks passed.` Then open one mainnet split on basescan.org and reactscan.net.

**Say:** "This is my own vault on Base mainnet, running since November 26th on real income. It costs about a quarter of a cent a day to run. Every action has three real transactions, and anyone can check them with one command. That includes a payment from a look-alike address, built to trick me, that Steward correctly ignored."

**Update before recording:** the days running and total saved. Take them from the checker's output.

## Scene 6: safety limits and the repo (2:45–3:00)

**Show:** `docs/architecture.png` for two seconds, README "Safety limits", then the repo URL and the app URL as a closing card.

**Say:** "Funds can only go to my vault, my cold wallet, or my beneficiary after a full Guardian cycle. I can always withdraw, even while paused. The code is open, tested and verified. Steward: set it and forget it. github.com/Alpha-Hackathon-Grinding-Society/steward."

## After recording

1. Check the length is **under 3:00**.
2. Upload as unlisted (YouTube or Loom) and paste the link into `README.md` ("Demo video"), `JUDGES.md` and `docs/SUBMISSION.md`.
3. If any scene used live runs, add their hashes to `docs/TX_HASHES.md` and their loops to `scripts/evidence.json`, then rerun `make check-live`.
