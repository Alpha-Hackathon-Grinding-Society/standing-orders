# DoraHacks submission

Copy each block into the matching field of the BUIDL form. Fill in the `TODO`s when they're ready.

## Name

Steward

## Tagline (one line)

Set your money rules once: save from every paycheck, claim your vesting, and pass your savings on if you go silent. Every rule runs in your own Reactive contract.

## Track

Set It and Forget It

## Links

- Live app: https://steward-reactive.vercel.app/
- The builder's real mainnet vault, read-only in the app: https://steward-reactive.vercel.app/?watch=0x810fCBF8A695Ffa0e4480207c667995139F33276&net=mainnet
- Sample dashboard with no wallet: https://steward-reactive.vercel.app/?preview=active
- Repository: https://github.com/Alpha-Hackathon-Grinding-Society/steward
- Demo video: TODO (under 3 minutes)
- Judges' guide: https://github.com/Alpha-Hackathon-Grinding-Society/steward/blob/main/JUDGES.md

## Description

**The problem.** Good money habits fail because they need you to act every time: move part of each paycheck into savings, claim tokens as they vest, and make sure your savings reach someone you trust if something happens to you. Bots and keepers can automate this, but then a server and a hot key hold power over your money.

**What Steward does.** Each user gets one savings vault on Base and three rules:

1. **Pay yourself first.** When USDC from a sender you listed reaches your wallet, a share you choose (1–50%) moves into your vault, up to a cap per period.
2. **Claim and secure.** On a schedule, tokens vested to you in an OpenZeppelin `VestingWallet` are released and moved into your vault, or on to a cold wallet.
3. **Guardian.** If you show no signed activity on any chain you use for a set time, the Guardian warns. If you stay silent through a grace period, your vault goes to your beneficiary.

**Why it needs Reactive.** Every decision lives in the user's own `Rulebook` reactive contract, deployed from their own wallet. It subscribes to their events on two origin chains, always filtered on their address, plus Reactive's cron. When a rule fires, it sends a callback to a single executor on Base. The executor accepts a call only from Reactive's callback proxy, only from the Rulebook that user registered, and only with a fresh nonce. Nothing runs off-chain: no bot, no server, no hot key.

**It's live on mainnet.** The builder's own vault has run on Base mainnet with Reactive mainnet since 26 November 2026, on real income. Real splits have moved USDC into the vault in about 1.5 seconds from payment to savings, and the Guardian has recorded the owner's activity. Rule 1 also ignored an address-poisoning payment from a look-alike sender. It costs about a quarter of a cent a day to keep the rules running (1.3 REACT) and about a fifth of a cent of Base gas per automatic split. Anyone can open the live vault in the app, read-only, from the link above. Every mainnet contract is verified: on Basescan for the Base contracts, and on Sourcify as an exact match for all of them, the Rulebook on Reactive included. `node scripts/check-live.mjs` re-checks every recorded loop from public RPCs, with no keys.

In the first user's words: *"I just need to transfer to my wallet, and Steward saves for me without me knowing."* (Daniel, builder and first user)

**Safety.** Funds can reach only the user's vault, their cold wallet (through the vault), or their beneficiary after Warning plus a full grace period. The owner can always withdraw, even while paused. Beneficiary and cold-wallet changes wait 24 hours. Steward's own automated moves never count as the user being alive. Each of these seven limits is enforced in the contracts and checked by an invariant suite of 1,000 runs × 50 steps.

**Built with.** Solidity, Foundry and `reactive-lib-omni`; OpenZeppelin; Next.js, wagmi, viem and RainbowKit. 124 contract tests (unit, fuzz, invariant, fork) and 84 app tests. Slither triaged.

## Images

- Architecture: `docs/architecture.png` (also `docs/architecture.svg`)
- Screenshot of the live mainnet vault through the watch link: `docs/screenshots/live-mainnet-vault.png` (2026-11-27, with Guardian activity on Base and Arbitrum)

## Deployed contracts

**Mainnet** (Base 8453, Reactive 1597)

| Contract | Address |
| --- | --- |
| VaultFactory (Base) | `0x4461142Af87f775242Ff27B0aBB7Ac8b7BFA9686` |
| OrdersExecutor (Base) | `0xEaA3CB8cdE5d079CC6da775d21517F7770712036` |
| Heartbeat (Base) | `0xFBD66e0C9Db8dA83C45c38AB859D12C228AC6447` |
| Builder's SavingsVault (Base) | `0xD5f071D9e4E32a2f4004742AFFD77C127f14Dc75` |
| Builder's Rulebook (Reactive) | `0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a` |

**Testnet** (Base Sepolia 84532, Unichain Sepolia 1301, Lasna 5318007)

| Contract | Address |
| --- | --- |
| VaultFactory (Base Sepolia) | `0x207feeecD8b2f6F479be2Ed591F309F06501F0cc` |
| OrdersExecutor (Base Sepolia) | `0x12B9D62B13e626163114588DCBa51C6a7B88CCEC` |
| Heartbeat (Base Sepolia) | `0xe6847bA8f223c74f64f8C317dB5a40A848740EA8` |
| Test USDC with permit (Base Sepolia) | `0x12E627587Ef1d653014AE6ABf9759DB2Ee5C1F2a` |

## Transaction hashes, one loop per rule

Each row is origin → Reactive → callback.

| Rule | Network | Origin | Reactive | Callback |
| --- | --- | --- | --- | --- |
| Rule 1 split | Mainnet | `0xe98c0af12daabde1f1bc4908d79e452e4ef9d81e2e124adf654034a6d70ccd86` | `0xf32c83d342bdd748710f03576c23986b8d4dd9bd521729e1e19074b022558b81` | `0x95f8b3c1e0d4498a2e86b215612d4f69790cd9ce27d7392237e67a96eb383eb0` |
| Guardian activity (I'm alive) | Mainnet | `0x7f090f8fe730f4bb4d90c18eb3c06807708ec5ad503d3c674f9f4bf4257d5696` | `0xeac133f9259ae9abfc3fb37c019b1927f1823e7c1e042dd80fe619c2722f4a42` | none needed |
| Rule 1 split | Testnet | `0x36a4200afdf67756bb09d2f24dcfba16862ba0ad182acc5f7c851904dc460095` | `0xda7a63891d09d89812ac5e164a0321437b54f8bcb8fec7fda8660bc2b25a2dc5` | `0x5dfcca7df4f273fcbe0ced13abde6e527b59f9dc3128d37979d79be6e58c53b0` |
| Rule 2 claim | Testnet | cron tick | `0x4a62e41b6ec1aeeff33aaf9fa633127397bea829411f9ac3a711edd13ae65129` | `0xabf27e8ec64fd6ba9cedcf05a4a266196f7ad7428d632da1eb0d8ba7a6783ce4` |
| Guardian cleared from a second chain | Testnet | `0xf73cdb6848b4ec58c7d1ac358c39d6b7a3f1e4a351455969e3a0a6dc0d2d076f` (Unichain Sepolia) | `0xe86ee39820192c3b5fdba3bc578d4750f43b7c53ed27b019115dbb317c1f9642` | none needed |
| Guardian release | Testnet | cron tick | `0xdf94be3488bbe60d96c4c8e5f94a2861424328b3bc27fc53afa2b2dda6b746da` | `0x0e9f2cc81682c7334946b566767b109f02f463c873763be4b4f69b3ab31c99a2` |

Every run since Phase 1 is in `docs/TX_HASHES.md`. The mainnet log is in `docs/MAINNET_USAGE.md`.

## Team

One builder: TODO (your name or handle as it should appear). All work was built during the event; the first commit is from 12 November 2026.

## Final checklist (Phase 7)

- [ ] Registered in the Set It and Forget It track
- [x] Public repository link (MIT): https://github.com/Alpha-Hackathon-Grinding-Society/steward
- [x] Deployed addresses, testnet and mainnet (above)
- [x] Transaction hashes for every rule (above; re-checked by `make check-live`)
- [ ] Demo video under 3 minutes (script: `docs/DEMO.md`)
- [x] All work built during the event (first commit 2026-11-12)
- [ ] Someone who did not build it has set up a vault from the page (steps: `JUDGES.md` §6)
- [ ] Mainnet vault has run 7+ days (from 2026-11-26 to 2026-12-03); usage table updated
- [ ] Submitted on DoraHacks; confirmation saved in `docs/PROGRESS.md`
