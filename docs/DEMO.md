# Demo video: script, shots and publishing

**Target:** 2:45–2:55 (the limit is 3:00). The title is "Steward: your money rules run themselves | Reactive Network".

**The idea.** Open on the result: money saving itself in about 1.5 seconds. Then the problem, then the three rules, each shown working on-chain. The Guardian's full cycle on **mainnet** is the emotional peak. End with proof anyone can check.

**Why it works with judges:**
- real numbers on screen;
- every sped-up wait labelled;
- every claim backed by a transaction they can open.

Every scene has a **fallback** of real on-chain hashes, so a failed live take never blocks the video.

---

## 1. Before filming

### Accounts and funds (already prepared)

| Account | Used in | Funded | Notes |
| --- | --- | --- | --- |
| Main wallet `0x810f…3276` (Steward Test) | Scenes 1, 7, 8 | yes | Your real mainnet vault. 0.00019 ETH on Arbitrum for the Scene 7 signature. |
| Steward Payer `0x69Df…32c9` | Scene 1 | 0.40 USDC on Base | Its daily 0.10 USDC payment to the main wallet *is* the hook. |
| Fresh account `0xD822…5d87` | Scenes 4–5 | 0.002 Base Sepolia ETH, 0.95 lREACT | Testnet setup, **one take only** (one vault per address) |
| PC wallet `0x1501…0502` | Scene 5 (pays the fresh account), Scene 6–7 footage (owns the showcase vault) | yes | Claude runs "pay now" from it on cue |

### Screen
- **OBS Studio:** 1920×1080, 30 fps, one scene per window.
- **Browser:** zoom **125%**, bookmarks bar hidden, other extensions' icons hidden.
- **Terminal:** font size **20** or more, dark theme, repo root.
- **Cursor:** turn on a cursor highlight (OBS "Cursor highlight" plugin, or PowerToys "Mouse highlighter").
- Close notifications. Use the dark Windows theme.

### Tabs to have open, in this order

1. App, testnet, fresh account: https://steward-reactive.vercel.app/
2. Your mainnet vault, read-only: https://steward-reactive.vercel.app/?watch=0x810fCBF8A695Ffa0e4480207c667995139F33276&net=mainnet
3. The showcase vault, read-only: https://steward-reactive.vercel.app/?watch=0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502&net=mainnet
4. Your mainnet Rulebook on Reactscan: https://reactscan.net/address/0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a
5. The showcase Rulebook on Reactscan: https://reactscan.net/address/0x4461142Af87f775242Ff27B0aBB7Ac8b7BFA9686
6. Arbitrum USDC, Write as Proxy: https://arbiscan.io/address/0xaf88d065e77c8cC2239327C5EDb3A432268e5831#writeProxyContract
7. Basescan, the OrdersExecutor's verified code: https://basescan.org/address/0xEaA3CB8cdE5d079CC6da775d21517F7770712036#code

### Voice and music
- **Voice:** record your own (a quiet room, phone close to your mouth), or use ElevenLabs' free tier with a calm, warm voice at 0.95× speed. Paste the voiceover below one scene at a time.
- **Music:** one calm electronic track from the YouTube Audio Library (free), at about −22 dB under the voice. Fade it out over the last 3 seconds.
- **Captions:** burn them in (CapCut "Auto captions", then correct the crypto words). Many people watch with the sound off.

---

## 2. Scenes

Voiceover is about 390 words. At a calm 145 words a minute that is about 2:42, which leaves room for pauses. **On-screen text** is a short overlay in the app's style: mono, uppercase, white on black, bottom left.

### Scene 1: hook (0:00–0:08)
**Show:** a split screen. On the left, MetaMask on Steward Payer sends **0.10 USDC** to your main wallet. On the right, tab 2, your real vault. When the payment lands, the vault balance ticks up by **0.02**. Then zoom in on the balance.
**On-screen text:** `REAL MAINNET · 1.5 S FROM PAYMENT TO SAVINGS`
**Voiceover:** "I just got paid. Before I even looked, twenty percent was already in my savings. No app open. No bot. No server."
**Film it:** this is today's daily payment, so record it whenever you send one. The page refreshes every 15 s; press F5 right after the payment for an instant update.
**Fallback:** the money map's payment panel on tab 2, opened on the 1.00 USDC payment.

### Scene 2: the problem (0:08–0:22)
**Show:** black screen, with three lines typing in one after another in mono:
```
SAVE PART OF EVERY PAYCHECK.
CLAIM YOUR VESTED TOKENS.
MAKE SURE YOUR FAMILY CAN REACH YOUR CRYPTO.
```
**Voiceover:** "We all know the rules. Save part of every paycheck. Claim your vested tokens. Make sure your family can reach your crypto if something happens to you. We mean to. Most of us never do."

### Scene 3: what Steward is (0:22–0:32)
**Show:** tab 1, freshly loaded, so the boot animation plays. Then the money map, with the architecture image (`docs/architecture.png`) for 2 seconds.
**On-screen text:** `STEWARD · BUILT ON REACTIVE NETWORK`
**Voiceover:** "Steward turns those rules into contracts that run themselves. Every decision lives in your own Rulebook on Reactive Network, watching your wallets on Base and Arbitrum."

### Scene 4: setup in three signatures (0:32–0:55)
**Show:** tab 1 on testnet with the fresh account. Click `[ SET UP YOUR RULES ]` and fill in:
- share **20%**
- who pays you: `0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502`
- cap 25 per 30 days, budget 100
- claim off; Guardian on at 90 and 14 days
- beneficiary `0x810fCBF8A695Ffa0e4480207c667995139F33276`
- REACT 0.5

Then hold on the `// REVIEW` panel. Sign the three steps, and hold on each `(~) PENDING → (v) SUCCESS` row.
**On-screen text:** `TESTNET · SPED UP 2×` (speed up the waits only)
**Voiceover:** "Setting up takes one page. I choose who pays me, how much to save, and who should receive my savings. I sign a capped USDC permit, create my vault on Base, and deploy my own Rulebook on Reactive. Three signatures, and I never have to touch it again."
**Fallback:** the Phase 5 setup in `docs/TX_HASHES.md`.

### Scene 5: pay yourself first, live (0:55–1:20)
**Show:** the new dashboard. Tell Claude **"pay now"** (it sends 100 test USDC from the listed sender). The vault card shows **20.00 USDC** and the money map gains a payment. Then three explorer tabs side by side: the payment on Base Sepolia, `SplitRequested` on Lasna (it names the payment's hash), and `SplitExecuted` on Base Sepolia.
**On-screen text:** `3 TRANSACTIONS · 2 CHAINS · ~2 S`, then `MAINNET: 1.5 S`
**Voiceover:** "Now someone on my list pays me a hundred test USDC. Reactive sees the payment, my Rulebook takes twenty percent and sends a callback to Steward's executor on Base, which moves twenty USDC into my vault. Three transactions, two chains, about two seconds. On mainnet, with real money, it took one and a half."
**Fallback:** README testnet row "Rule 1 split" (`0x36a4…` → `0xda7a…` → `0x5dfc…`).

### Scene 6: claim and secure, on mainnet (1:20–1:40)
**Show:** the showcase time-lapse clip (`C:\Users\adedo\Videos\steward-showcase\timelapse.webm`): tab 3's vault balance rising with each hourly claim. Cut to Reactscan (tab 5) and open one `ClaimRequested` transaction, then its `ClaimExecuted` callback on Basescan.
**On-screen text:** `MAINNET · REAL USDC · OPENZEPPELIN VESTINGWALLET · 1 HOUR = 1 SECOND`
**Voiceover:** "Claim and secure works on a clock. This vault on Base mainnet holds a real OpenZeppelin vesting contract. Every hour, a cron tick on Reactive claims whatever has vested and moves it into the vault. No one presses anything."
**Fallback:** README testnet row "Rule 2 claim" (`0x4a62…` → `0xabf2…`).

### Scene 7: the Guardian, a full cycle on mainnet (1:40–2:15)
**Show, in three beats:**
1. **Activity on a second chain.** Tab 6 (Arbiscan, connected to your main wallet): `approve`, spender = your own address, value `0`, then sign. Switch to tab 2: the Guardian card reads **Arbitrum: a few seconds ago**.
2. **Silence, then Warning.** The time-lapse continues: the showcase vault's Guardian card turns from `(v) ACTIVE` to `[!] WARNING`, and the countdown to release appears.
3. **Release.** The card shows `(v) RELEASED`. Cut to Basescan: the `VaultReleased` callback and the USDC arriving at your main wallet.

**On-screen text:** `4 HOURS OF SILENCE · 1 HOUR GRACE · SPED UP`, then `RELEASED TO THE BENEFICIARY · MAINNET`
**Voiceover:** "And this is the Guardian. It watches for anything I sign, on every chain I use. Here I sign one action on Arbitrum, and a second later my clock resets on Reactive. If I go silent, it doesn't act right away. It warns first, and any activity clears the warning. Only after a full grace period of silence does the vault go to the person I chose. Here is that full cycle on mainnet: active, warning, released, and the money arrives with my beneficiary."
**Hashes:** see "Mainnet showcase" in `docs/TX_HASHES.md`, filled in after the release on 2026-11-28.
**Fallback:** README testnet rows "Guardian warning", "cleared by activity on a second chain" and "release".

### Scene 8: proof (2:15–2:35)
**Show:**
- Tab 2: scroll to `// SAVING DAYS` (the streak, days with money in), then the `>> WATCHING` note.
- The terminal: `node scripts/check-live.mjs --mainnet`. Let the `ok` lines scroll, then hold on `All checks passed.`
- Tab 7: Basescan "Contract Source Code Verified".
- Your quote on screen.

**On-screen text:** `ANYONE CAN CHECK · NO KEYS NEEDED`, then `≈ $0.003 A DAY TO RUN`, then the quote:
> "I just need to transfer to my wallet, and Steward saves for me without me knowing." (Daniel, builder and first user)

**Voiceover:** "This is my own vault, running on mainnet since November twenty-sixth. Every day money comes in lights up here. Anyone can open it read-only, and one command re-checks every transaction from public data. It costs about a quarter of a cent a day to run."

### Scene 9: safety limits and close (2:35–2:50)
**Show:** three lines in mono on black, then the logo with the two links:
```
FUNDS GO ONLY TO YOUR VAULT, YOUR COLD WALLET, OR YOUR BENEFICIARY.
A RELEASE NEEDS A WARNING AND A FULL GRACE PERIOD.
YOU CAN ALWAYS WITHDRAW, EVEN WHILE PAUSED.

steward-reactive.vercel.app
github.com/Alpha-Hackathon-Grinding-Society/steward
```
**Voiceover:** "Funds only ever go to my vault, my cold wallet, or my beneficiary after a full Guardian cycle, and I can always withdraw. Steward: set your money rules once, and forget them."

---

## 3. Film in this order (not story order)

1. **Scenes 6–7 footage:** done for you. The time-lapse and the showcase hashes are captured tonight, 2026-11-27/28.
2. **Scene 7, beat 1:** the Arbitrum signature (2 minutes, any time).
3. **Scenes 4–5:** the testnet setup and live split with the fresh account. Tell Claude "pay now" at the right moment.
4. **Scene 1:** during your next daily payment from Steward Payer.
5. **Scenes 2, 3, 8, 9:** screen-only shots, any time.
6. **Voiceover**, then edit to the voice: cut each scene's footage to its voice line.

## 4. Editing checklist

- [ ] Length 2:45–2:55
- [ ] Every sped-up or cut wait is labelled on screen
- [ ] Captions burned in and checked (Reactive, USDC, Rulebook, Arbitrum)
- [ ] Zoom in (CapCut "zoom" keyframes) on the numbers that matter: 1.5 s, +0.02, 20.00 USDC, WARNING, RELEASED, All checks passed
- [ ] No private data on screen: no seed phrases, no `.env`, no full-screen MetaMask account list
- [ ] Music under the voice, faded out at the end
- [ ] Export 1080p, then upload to YouTube as **Unlisted** or **Public**

---

## 5. Publishing on YouTube

**Title:**
```
Steward: your money rules run themselves | Reactive Network
```

**Description:**
```
Steward: set your money rules once, and they run themselves on-chain.

Every user gets a savings vault on Base and their own Rulebook, a reactive contract on Reactive Network that watches their wallets on Base and Arbitrum and makes every decision. No bot, no server, no hot key.

1. Pay yourself first: when a listed sender pays you USDC, a share you choose moves to your vault. Live on mainnet: about 1.5 seconds from payment to savings, across two chains.
2. Claim and secure: vested tokens are claimed on a schedule from a real OpenZeppelin VestingWallet.
3. Guardian: if you go silent on every chain, it warns, waits a full grace period, then releases your vault to the person you chose. Shown here on mainnet with real USDC.

Chapters:
00:00 Paid, and already saved
00:08 The problem
00:22 What Steward is
00:32 Setup in three signatures
00:55 Pay yourself first, live
01:20 Claim and secure on mainnet
01:40 The Guardian: a full cycle on mainnet
02:15 Proof anyone can check
02:35 Safety limits

Try it: https://steward-reactive.vercel.app/
See the builder's real mainnet vault, read-only: https://steward-reactive.vercel.app/?watch=0x810fCBF8A695Ffa0e4480207c667995139F33276&net=mainnet
Code, tests and every transaction hash: https://github.com/Alpha-Hackathon-Grinding-Society/steward
Check every claim yourself, no keys: node scripts/check-live.mjs

Built for the Reactive Omni Buildathon, Set It and Forget It track.

What is real and what is sped up: Scene 1 and Scenes 6–8 are Base and Reactive mainnet with real USDC. Setup and the live split (Scenes 4–5) are on testnet. The Guardian demo vault uses short timers (4 hours of silence, 1 hour of grace) and is shown as a time-lapse; the builder's own vault uses 90 days and 14 days. Small, unaudited amounts only.

#ReactiveNetwork #Base #Arbitrum #DeFi #Savings #Buildathon
```

**Thumbnail:** `docs/video/thumbnail.png` (1280×720).

**After upload:** paste the link into `README.md` ("Demo video"), `JUDGES.md` and `docs/SUBMISSION.md`, and on the DoraHacks page.
