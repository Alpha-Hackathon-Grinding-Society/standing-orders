# Progress

One report per phase, newest last. Template in CLAUDE.md.

## Phase 0 report: Setup

Gate: PASSED. CI green on `devops` (run 43456412724) and on `main` after PR #1 merged (commit `7de1f7e`).

Built
- Foundry project in `contracts/` (`foundry.toml`, `remappings.txt`, layout from CLAUDE.md with `src/`, `script/e2e`, `script/ops`, `test/{unit,fuzz,invariant,fork}`, `deployments/`)
- Pinned submodules: forge-std v1.17.0, OpenZeppelin v5.7.0, reactive-lib-omni v0.1.0 (`.gitmodules`)
- `contracts/src/libraries/ReactiveConstants.sol`: cron topics, legacy and Omni system addresses, minimum callback gas
- `contracts/test/unit/ReactiveConstants.t.sol`: placeholder suite proving the library compiles and the constants are right
- `.env.example` with every RPC, chain ID, callback proxy, faucet and API-key variable later phases need
- `Makefile`: install, build, test, fmt, fmt-check, coverage, slither, clean, four deploy targets, five e2e targets (`make help`)
- `.github/workflows/ci.yml`: `make install`, `make fmt-check`, `make build`, `make test` on every push and PR (web job reserved for Phase 5)
- `.gitignore` (`.env` ignored, `.env.example` tracked), `.gitattributes` (LF), MIT `LICENSE`, `README.md` stub
- `docs/NOTES.md`: every Phase 0 task 5 question answered with file:line references into the library and the docs

Tests
- forge test: 4/4 passed (local and CI); coverage not meaningful yet (no product code)
- forge fmt --check: clean
- invariants: none yet
- frontend: not started (Phase 5)

On-chain evidence
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| none in Phase 0 | | | | |

Decisions and findings
- solc 0.8.30, contracts on `^0.8.29`: the Omni library requires `^0.8.29` (NOTES §1). CLAUDE.md said `^0.8.20`.
- Omni has no vm / ReactVM split, so `editRules` and `checkNow` are ordinary functions that share state with `react()` (NOTES §2).
- **The injected callback sender is the reactive contract's address, not the deployer wallet** (NOTES §6). The "ReactVM id = deployer" fact does not hold in Omni.
- Callbacks are paid in ETH by the recipient on Base, and rejected callbacks are still charged (NOTES §8).
- Cron comes from `0x…fffFfF`, every tick is billed, and the docs and demo disagree on block time (~1 s vs ~7 s) (NOTES §7).
- `reactive-test-lib` is legacy-only; we'll write two small Omni mocks in Phase 1 (NOTES §10).
- Mainnet REACT: official WREACT↔REACT bridge from Base exists (NOTES §9).
- Local toolchain: Foundry 1.9.0 installed. `make` and Slither aren't installed on the dev machine; CI runs `make`, and locally the forge commands run directly.

Risks and open questions
- Callback auth: switch to "injected sender = the Rulebook the owner registered". Proposed default in NOTES "Design impact A".
- Setup order flips to Reactive first, then Base, so the vault can register the Rulebook. Still one tx per chain plus one permit (Design impact A).
- The shared executor pays ETH for every user's callbacks and can be griefed. Default: operator-funded float plus a public `coverDebt()`, revisited after Phase 1 cost measurements (Design impact B).
- Cron choice: default `Cron10` on testnet and `Cron1000` on mainnet, finalised from Phase 1 measurements (Design impact C).
- The Lasna EVM version is undocumented; `cancun` set, Phase 1 confirms.

Next
- Phase 1 needs: a funded test wallet in `.env` (`PRIVATE_KEY`) with Base Sepolia ETH and ≥ 5 lREACT (send ~0.05 Sepolia ETH to the Base Sepolia faucet), plus your answer on Design impact A, which shapes `HelloReceiver`'s auth check.
- Merge the `devops` → `main` PR to finish the gate.

## Phase 1 report: Hello loop + cron

Gate: PASSED. One full loop has three tx hashes in `TX_HASHES.md`; 68 cron ticks were recorded (≥ 5 required); the ReactVM id finding is recorded. That finding is the "not the deployer" case the brief says to stop on, and it was already resolved by the approved Design impact A.

Built
- `contracts/src/mocks/MockUSDC.sol`: test USDC with 6 decimals and EIP-2612 permit (reused in Phase 2)
- `contracts/src/hello/HelloReceiver.sol`: Base Sepolia callback receiver; `ping` guarded by proxy sender + injected reactive sender
- `contracts/src/hello/HelloReactive.sol`: Lasna reactive contract; MockUSDC `Transfer` → `ping` callback; optional cron tick counter; owner `stopCron`; public `coverDebt`
- `contracts/src/hello/WildcardProbe.sol`: confirms the Guardian's subscription shape (any contract, user as indexed topic)
- `contracts/test/mocks/MockSystem.sol`, `MockCallbackProxy.sol`, `test/helpers/LogRecords.sol`: Omni test doubles and synthetic `LogRecord` builders for Phase 2+
- `contracts/script/hello/DeployHelloBase.s.sol` (predicts the Lasna address from the deployer nonce), `DeployHelloReactive.s.sol` (refuses if the nonce moved), `DeployWildcardProbe.s.sol`; `script/e2e/Hello.s.sol`, `hello.sh`, `hello-cron.sh`, `WildcardActivity.s.sol`; `script/ops/HelloStopCron.s.sol`
- Makefile: `deploy-hello-base`, `deploy-hello-lasna`, `hello-stop-cron`, `e2e-hello`, `e2e-hello-cron`
- `docs/TX_HASHES.md` (new), `docs/NOTES.md` §11 (live measurements), updated §1, §5, §7, Design impact C and the facts table

Tests
- forge test: 28/28 passed; coverage of `src/` 100% lines (65/65), 100% branches
- forge fmt --check: clean
- invariants: none yet (Phase 3)
- frontend: not started (Phase 5)

On-chain evidence
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Hello loop | Base Sepolia → Lasna → Base Sepolia | `0xc2011d6f734efc46e7f8916fff02088d95978338bdea7c44db72ce9b595b2d0c` | `0x67e2655cc92b6c2e5338d6452f4848f8aac648a32955aa26dec83c6dd7ffaa88` | `0x57e06841b244534ada9b65bdde81ab8ffbe4510f3904ce14b2194bc4d554a1f6` |
| Wildcard `Transfer` (probe) | Base Sepolia → Lasna | `0x4e45fa0dac2dfd56ab34ed0dcff26a4f5a43cf70ef2e065cecbd75631bf16f99` | `0x952de17684c2669cb5e296aea96467f5c0c132d6134a73dd9b3465681e32de83` | none |
| Cron tick #1 of 68 | Lasna | none | `0x11609abf35ae7b8e7e6cf9bab143777cdf1197fc8caf3a6c07f86f53ad72dd12` | none |

Decisions and findings (NOTES §11)
- **Injected callback sender = the reactive contract's address**, confirmed live twice. Design impact A (approved) handles it: the executor checks `injectedSender == rulebookOf[user]`.
- **Callback gas limit = the whole destination tx limit.** The proxy keeps ≈ 135k, so the budget is method + 160k. Run 1 used 200k: delivered, `ping` ran out of gas, and the recipient was still charged. Phase 2's executor needs a gas-budget test like `test_callbackGasCoversPingPlusProxyOverhead`.
- Latency origin → callback ≈ 1 s (6 Base Sepolia blocks).
- Lasna block time is 1.07 s and `Cron10` = 10.6 s. A minimal tick costs 0.0122 lREACT, so `Cron10` ≈ 100 lREACT/day and `Cron1000` ≈ 1/day. Even ignored events cost ≈ 0.011 lREACT, so subscriptions should filter on topics, not in `react()`, wherever possible.
- Reactive txs have gas price 0; cost is debited from the contract's balance in the same block.
- `SYSTEM.getCallbacks` returned `[]` on Lasna for delivered callbacks; scripts read the recipient's events instead.
- Callback cost on Base Sepolia ≈ 0.0000012 ETH per 161k-gas delivery, so the Design B float is cheap.
- `forge script` works on Lasna (no need for `forge create`). `cancun` bytecode runs on Lasna.
- Design impact A and B approved by the user on 2026-11-15.

Risks and open questions
- **Cron per network (Design impact C)**: proposed default is a constructor setting: `Cron1000` on mainnet (≈ 1 REACT/day), `Cron10` only for short demo runs, `Cron100` for long-running testnet Rulebooks. Needs your OK before Phase 2 wires it in.
- `WildcardProbe` stays subscribed to the deployer's Base Sepolia Transfers/Approvals and will spend its 0.27 lREACT on Phase 2 test traffic, then stop at debt. That's harmless; default is to leave it.
- Lasna RPC timeouts happen (one deploy simulation failed and was retried). Scripts retry where it matters.
- Mainnet REACT gas price not yet checked; Phase 4.

Next
- Phase 2 needs: your answer on the cron default above, and the remaining test funds, which are enough as they stand (PC wallet 2.63 lREACT and 0.018 Base Sepolia ETH). If Phase 2 runs a `Cron10` Rulebook for long, we'll need another faucet top-up.
- Merge `backend` → `main` when you're happy with this report.

## Phase 2 report: Vault + Rule 1 (valid-entry milestone)

Gate: PASSED. All tests green; `src/` line coverage 100% (≥ 90% required). A full Rule 1 loop ran on Base Sepolia ↔ Lasna with origin, Reactive and callback hashes in `TX_HASHES.md`. The unlisted-sender payment reached the Rulebook and produced no split. Steward is now a scorable entry.

Built
- `contracts/src/SavingsVault.sol`: owner deposit/withdraw (works while paused), owner-only `Deposited`/`Withdrawn`, beneficiary set at creation then `proposeBeneficiary` → `applyBeneficiary` after 24 h; `release` / `forwardToColdWallet` executor-only stubs (Phase 3)
- `contracts/src/OrdersExecutor.sol`: `split(rvmId, user, token, amount, nonce)` checks the proxy, that the injected sender is the user's registered Rulebook, that the user is registered, the nonce is unused and the user is not paused; then `transferFrom(user, vault)`. User `pause`/`unpause` emit `Paused`/`Unpaused`; public `coverDebt`
- `contracts/src/VaultFactory.sol`: deploys the executor; `createVault({token, rulebook, beneficiary}, permit)` with CREATE2 (salt = owner), front-run-safe permit, registration; `predictVault`; one vault per owner
- `contracts/src/Rulebook.sol`: Rule 1 (subscription `Transfer(to = user)` on USDC, listed-sender filter, bps share, per-period cap that resets on cron and lazily), owner `editRules`, public `coverDebt`, cron topic as a setting
- `contracts/src/Heartbeat.sol` (`alive()`), `contracts/src/mocks/MockPayer.sol` (test employer)
- Scripts: `script/DeployBase.s.sol`, `script/DeployRulebook.s.sol`, `script/ops/CreateVault.s.sol`, `script/e2e/Rule1Payers.s.sol`, `Rule1.s.sol`, `rule1.sh`, shared `lib.sh`; mainnet paths refuse to run without `STEWARD_MAINNET_APPROVED=true`
- Makefile: `create-vault-base-sepolia`, `test-fork`, `e2e-rule1` now runs the full loop; `.env.example` documents every rule setting
- README: what works today, the Rule 1 tx-hash table, how it works, how to run

Tests
- forge test: 82 passed, 1 skipped (the fork test, which needs `BASE_RPC`); passes against a Base mainnet fork with real USDC (`make test-fork`)
- Coverage of `src/`: 100% lines (244/244), 91.7% branches
- Required IDs: `test_V1_ownerDepositAndWithdrawEmitEvents`, `test_V1_withdrawWorksWhenPaused`, `test_V3_beneficiaryChangeWaits24h`, `test_F2_createVaultAppliesPermitAndRegisters`, `test_F2_secondVaultReverts`, `test_F2_vaultAddressPredictable`, `test_S1_S2_onlyListedSenderTriggersSplit`, `test_S3_shareRespectsBps`, `testFuzz_S3_neverExceedsPeriodCap`, `test_S3_capResetsAfterPeriod`; executor rejects non-proxy, wrong Rulebook, unknown user, replayed nonce, paused user; `test_S3_neverMovesMoreThanAllowance` + fuzz. Also F-1, S-1, V-2, U-3 and an end-to-end `Rule1Flow` test
- Invariants: Phase 3

On-chain evidence
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 1 split (listed sender) | Base Sepolia → Lasna → Base Sepolia | `0x36a4200afdf67756bb09d2f24dcfba16862ba0ad182acc5f7c851904dc460095` | `0xda7a63891d09d89812ac5e164a0321437b54f8bcb8fec7fda8660bc2b25a2dc5` | `0x5dfcca7df4f273fcbe0ced13abde6e527b59f9dc3128d37979d79be6e58c53b0` |
| Rule 1 ignored (unlisted sender) | Base Sepolia → Lasna | `0x0c02b7c6415dd4ed7552102742b145401bb67d7eb3cfe49e60a561842d139798` | `0xce4582125e24c26069381b96d52de0cab9bbd0b27727d9d7f0f84ef42c890c46` | none (by design) |

Decisions and findings (NOTES §12)
- Rule 1 origin → callback ≈ 2 s. A split costs 0.0182 lREACT on Lasna plus 0.0000010 ETH on Base Sepolia; an ignored payment costs 0.0115 lREACT.
- Real Base USDC accepts our permit, and its `transferFrom` emits no `Approval`, so executor pulls can't fake user activity.
- Code-level choices that follow approved A/B/C: `rulebook` in `createVault`'s config; the factory deploys the executor (no admin key); `AbstractCallback` built with `address(0)` as sender; lazy plus cron period reset; cron as a setting.
- Safety invariant 4 now reads "only from the callback proxy, only when the injected sender is the Rulebook the vault owner registered, never with a repeated nonce" (Design A). CLAUDE.md still has the old wording; I haven't edited your brief.

Risks and open questions
- **The permit is a lifetime budget, not per period.** The executor's allowance shrinks with each split, and when it's used up, splits fail and are still charged. Default: the dashboard shows the remaining allowance (Phase 5) and an ops script re-signs it.
- **One vault per wallet per factory.** The PC wallet's Phase 2 vault is bound to this Rulebook. Phase 3 changes the executor (claim and release), so it redeploys `DeployBase` and gets a fresh factory, vault and Rulebook for the same wallet. No action needed.
- The Phase 2 Rulebook runs `Cron100` (≈ 10 lREACT/day) on 0.45 lREACT, so it goes into debt within about an hour and then stops. That's harmless: Phase 3 replaces it. Default: let it lapse.
- The test beneficiary is `0x…bEEF` (a placeholder). Phase 3's Guardian release e2e will use a beneficiary you choose; your phone wallet is a good option.

Next
- Phase 3 needs more lREACT. The PC wallet has 2.0 lREACT, and a Guardian demo Rulebook on `Cron10` burns ≈ 4 lREACT/hour. Please send about **0.05 Sepolia ETH** (≈ 5 lREACT) to the PC wallet `0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502`, or claim it from a faucet.
- Unichain Sepolia ETH for the second watched chain (G-4): a small amount (≈ 0.005 ETH) on the PC wallet.
- Tell me which address should be the Guardian test beneficiary.

## Phase 3 report: Rule 2 + Guardian

Gate: PASSED. All tests are green and the invariants hold at 256 runs × depth 50. A claim loop, a Guardian clear and a Guardian release are each recorded on testnet with tx hashes (run B). `GuardianWarning` and `GuardianCleared` are emitted on Lasna, visible on lasna.reactscan.net.

Built
- `SavingsVault`: cold wallet behind the same 24 h delay (`proposeColdWallet` / `applyColdWallet`), `forwardToColdWallet`, `release(tokens)` that sends every tracked balance to the beneficiary (both executor-only); tokens tracked on deposit and release
- `OrdersExecutor`: `claim` (requires the vesting wallet's owner to be the user, reads `releasable`, no-op on zero, `release`, pull into the vault, forward to the cold wallet if set) and `release` (empties the vault to the beneficiary); both go through the same proxy / Rulebook / nonce / pause checks
- `Rulebook`: Rule 2 schedule; Guardian across watched chains (`Transfer` from the user except into the vault, `Approval`, `Alive`, owner `Deposited`/`Withdrawn`, `Paused`/`Unpaused`); Active → Warning → Released by timestamps with a check interval; any activity clears a Warning; no callbacks while paused (a due release waits); unsubscribes everything on release; idle cron ticks exit after one comparison (`nextCronWork`); public `checkNow`
- `src/interfaces/IVestingWallet.sol`, `src/mocks/MockVestingWallet.sol` (OpenZeppelin's code unchanged), `MockToken.sol`
- Ops scripts for every user action (U-5) in `script/ops/UserOps.s.sol` via `make alive | pause | unpause | withdraw | propose-/apply-beneficiary | propose-/apply-cold-wallet | edit-rules | top-up-react | check-now | status`
- `script/e2e/Phase3.s.sol` + `phase3.sh` (`make e2e-phase3`): claim, clear from Unichain, release, on one Rulebook; `DeployRulebook` takes every Rule 2 and Guardian setting from env (`.env.example`)

Tests
- forge test: 119 passed, 1 skipped (fork test without `BASE_RPC`), 0 failed
- Coverage of `src/`: 99.8% lines (412/413), 93.2% branches
- Invariants: 256 runs × 50 depth (12,800 calls, 0 reverts), all seven holding: funds only to allowed places; release needs Warning + full grace; splits within cap; no forged or replayed callback succeeds; owner can always withdraw; only signed actions move the clock; beneficiary changes wait 24 h
- Required IDs: `test_C1_claimFiresOnInterval`, `test_C2_zeroReleasableIsNoop`, `test_C2_claimMovesVestedToVault`, `test_V4_coldWalletGoesThroughVault`, `test_G1_eachActivitySourceUpdatesClock`, `test_G1_transferToVaultIsNotActivity`, `test_G2_warningAfterSilence`, `test_G2_throttledByCheckInterval`, `test_G3_activityClearsWarning`, `test_G2_releaseOnlyAfterGrace`, `test_G5_checkNowAdvancesState`, `test_U3_noCallbacksWhilePaused`, plus G-4 subscriptions and full-system `StewardFlow` tests

On-chain evidence (run B, 2026-11-16)
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 2 claim | Lasna cron → Base Sepolia | Cron10 tick | `0x4a62e41b6ec1aeeff33aaf9fa633127397bea829411f9ac3a711edd13ae65129` | `0xabf27e8ec64fd6ba9cedcf05a4a266196f7ad7428d632da1eb0d8ba7a6783ce4` |
| Guardian → Warning | Lasna cron | Cron10 tick | `0xb2b49600f03332ccb5bbeb508ac508f0492ec7e6420f61232a955f3d00819c15` | none |
| Guardian → Active (Unichain activity) | Unichain Sepolia → Lasna | `0xf73cdb6848b4ec58c7d1ac358c39d6b7a3f1e4a351455969e3a0a6dc0d2d076f` | `0xe86ee39820192c3b5fdba3bc578d4750f43b7c53ed27b019115dbb317c1f9642` | none |
| Guardian → Warning (again) | Lasna cron | Cron10 tick | `0x3dd434dcad433e64fda16719193d5330ed830dc2de4ac448212a94cfc497a9f1` | none |
| Guardian → Released | Lasna cron → Base Sepolia | Cron10 tick | `0xdf94be3488bbe60d96c4c8e5f94a2861424328b3bc27fc53afa2b2dda6b746da` | `0x0e9f2cc81682c7334946b566767b109f02f463c873763be4b4f69b3ab31c99a2` |

The beneficiary (your phone wallet) received all 1,000 VEST; the vault ended empty. Run A, an unattended cycle after the session dropped, is also in `TX_HASHES.md`.

Decisions and findings (NOTES §13)
- Unichain Sepolia works as the second watched chain.
- Unsubscribe on release stops all REACT spending.
- A full demo run costs about 0.81 lREACT.
- Claims need the one-time approval first. The script now approves before deploying the Rulebook; run A showed what happens otherwise.
- A due release **waits while the user is paused**: the executor would reject it, and pausing is the user's explicit choice. Unpausing is activity, so it returns the Guardian to Active.
- The release token list is `[USDC, vesting token]` from the Rulebook, plus every token the vault has seen in a deposit.
- The executor checks that the vesting wallet's `owner()` is the user before releasing.
- The ops scripts are one file, `UserOps.s.sol` (one contract per action, run with `--tc`), rather than nine files.
- Both CREATE2 vaults on the Phase 3 factory are spent (runs A and B); the next testnet demo redeploys `DeployBase` (≈ 0.0001 ETH).

Risks and open questions
- **REACT left in a released Rulebook is stranded** (1.99 + 0.69 lREACT now). Proposed default: add an owner-only `withdrawReact(to, amount)` to the Rulebook in Phase 6 hardening. On mainnet that means a few REACT, not user savings.
- **The release callback has one shot.** If it fails on Base (for example, the executor is out of ETH), the Rulebook is already Released and unsubscribed. The owner can still withdraw, but the beneficiary gets nothing. Proposed default: keep the executor's ETH float monitored (dashboard + Status) and document it in SECURITY.md. A beneficiary-callable retry is possible later.
- Paused forever means no release, by design. This goes in the README's safety section.
- The full compile now takes about 3.5 minutes locally (larger Rulebook). CI should still be fine.

Next
- Phase 4 is the mainnet vault. It needs your explicit **"deploy to mainnet"**, plus:
  - a funded **mainnet** wallet: Base ETH (≈ 0.002 ETH for deploys and the executor float), a small amount of real USDC, and REACT on Reactive mainnet (≈ 10 REACT covers deploy + a week of `Cron1000`);
  - the per-period cap and REACT amount you approve;
  - your beneficiary, and income sender(s) for Rule 1.
- The PC test wallet is testnet-only. Mainnet should use a wallet you control; we can discuss how to sign from your phone.

## Phase 5 report: Frontend (one page)

Gate: NOT PASSED, one criterion open. "The Guardian card shows the live mainnet vault" cannot pass until Phase 4 puts a vault on Base mainnet, which is parked until mainnet funds are available. The mainnet network is wired into the page and shows `Mainnet · soon` until `contracts/deployments/base.json` exists. Every other exit criterion passes.

Built
- `web/`: Next.js 16 (App Router, Turbopack) + TypeScript, Tailwind v4 with the `docs/DESIGN.md` theme as `@theme` tokens (`web/app/globals.css`), Inter and Roboto Mono via `next/font`, wagmi 2 + viem + RainbowKit (injected wallet; WalletConnect when a project id is set), Base Sepolia, Base, Lasna and Reactive mainnet
- `web/scripts/sync-contracts.mjs` → `web/lib/generated/contracts.json`: addresses from `contracts/deployments/*.json` and the Rulebook creation bytecode
- Top bar (`TopBar.tsx`): logo, testnet/mainnet switch, Built on Reactive badge, `[ CONNECT WALLET ]`
- Guardian card (`GuardianCard.tsx`): symbol + word state, mono countdown, last activity per watched chain, `[ I'M ALIVE ]` as the one Royal button
- Controls (`Controls.tsx`): `[ PAUSE ALL ]` with a confirm step, `[ UNPAUSE ]`, `[ WITHDRAW ]` with Max; REACT balance with `[!] LOW REACT` and `(x) OUT OF REACT`
- Vault card (`VaultCard.tsx`): balance as the one large stat, total saved and days running from the executor's logs
- Rule cards (`RuleCards.tsx`): one plain sentence each, ASCII icon, `[ ON ]` / `[ OFF ]` / `PAUSED`
- Setup flow (`SetupFlow.tsx`, `lib/setup.ts`, `lib/rulebook.ts`, `lib/permit.ts`): three rule cards with plain-language fields and blur-first validation → `// REVIEW` in plain English → deploy the Rulebook on Reactive with REACT attached → vesting approval if Claim is on → USDC permit → `createVault` on Base, each a mono row `( ) WAITING` → `(~) PENDING` → `(v) SUCCESS` with its tx link, or `(x) FAILED · what to do next`. Pre-checks before any signature: no existing vault, vesting contract pays this wallet, predicted vault address. A deployed Rulebook is reused after a reload if its settings are unchanged
- States: ASCII spinner, empty state with `[ SET UP YOUR RULES ]`, failure sentences (`lib/tx.ts`), `?preview=<state>` sample data with a PREVIEW banner
- Make targets `web-install`, `web-sync`, `web-dev`, `web-check`, `web-e2e`; a CI web job (lint, typecheck, format, unit, build, Playwright)

Tests
- forge test: 119 passed, 1 skipped (fork test without `BASE_RPC`); contracts unchanged this phase
- invariants: unchanged since Phase 3 (256 × 50, all holding)
- frontend: lint, typecheck and format clean; Vitest 35 passed, 2 skipped (the live-chain test runs with `LIVE=1` and passed against the phone's vault); Playwright 16 passed (8 tests × desktop and Pixel 7: connect, Active, Warning, Released, Paused, Low REACT, No vault, setup form); CI green
- A unit test proves the page builds byte-for-byte the same Rulebook deploy as the script (`tests/unit/setup.test.ts`)
- Lighthouse accessibility: 100 on the home page and the active, warning, released and no-vault states (gate: 95)
- An independent checker reviewed the page against `DESIGN.md` and the PRD after a calibration run on a copy with a planted difference; its findings were fixed (theme tokens for every colour, the hero card radius and 64 px balance, one shared label component, Maya focus rings on inputs, spacing between signing rows, a one-sentence empty state)

On-chain evidence (2026-11-16, details in `TX_HASHES.md`)
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Setup from the page: Rulebook deploy | Lasna | `0x4f467cc0d3dca71f58627638c2fdbb3467e81dc5146daca2652019d3abb3831d` | | |
| Setup from the page: permit + createVault | Base Sepolia | `0xa6b56620b4fd2a00d6d03e132f874c4715931f29fbd2fdef196eb53a5f7592bf` | | |
| Rule 1 split into that vault | Base Sepolia → Lasna → Base Sepolia | `0x028b6f771094a4f46e40e2873703a100294b5ac6860827924ce230eb521728a1` | `0x32fcea5a5b4aae3fe4fb488753c1019fb5ed9cd6228585b6d19feffa88410136` | `0xca46265c602bfd5021a943acce0c3836f36561718983d082581e190cd33bcc88` |
| I'm alive from the page | Base Sepolia | `0x0e2c396362ef9e95c8d16a74ae420b9c4bcca1a4427e85418fcbea0f4ea196df` | | |
| Pause / unpause from the page | Base Sepolia | `0x6c54d2f821a4cc3bf5bac3ef25cdf11ebf145a9c54e3913b8b9852b3374c0afa` / `0x422bb2be821b1373810506c4f8fc8de0c7b91be9dc8dc9aa098cf90303c46dfe` | | |
| Withdraw 1 USDC from the page | Base Sepolia | `0x697a2b8cb772e7a7a820a27cae3611014ed8b1e08386c06ec2a9e7e3ef046dfb` | | |

Manual run: the user set up a second MetaMask mobile account (`0xc818…f0b7`, no key on this machine) from the page alone over the LAN. A 10 USDC payment from the listed sender put 2 USDC in the new vault in under 10 seconds.

Decisions and findings (NOTES §14)
- The page deploys Rulebooks on `Cron1000` on both networks: cheaper, and enough for a 1-hour Guardian check.
- Reactive has no Multicall3, so its reads use JSON-RPC batching; savings history reads use publicnode, whose RPC allows 50k-block log ranges.
- Kept on purpose:
  - `[ SIGN SETUP ]` is a second Royal button, but only in the setup view, never beside `[ I'M ALIVE ]`.
  - Inputs use mono, since they hold on-chain values.
  - Rule cards show status, with editing by script (`make edit-rules`), as the PRD scopes it.
  - "Built on Reactive" is a text badge until the official logotype is added from the press kit in Phase 6.
- Two failure sentences were added after the manual run: a wallet address typed as the vesting contract, and MetaMask error 4100 (the account wasn't connected to the site).
- Recent-actions list (P2) not built.

Risks and open questions
- **Mainnet card unproven** until Phase 4. Proposed default: run Phase 4 as soon as funds arrive (by about Nov 25–26 to leave 7 days), then confirm the card against the live vault and close this gate.
- **The page is LAN-only.** "Someone who did not build it sets up a vault from the page" (Phase 7) needs a public URL. Proposed default: deploy `web/` to Vercel when the repo goes public, after Phase 6.
- **Low test Rulebooks.** The phone's first testnet Rulebook is nearly out of lREACT and the new one has about 0.09. That's fine for this gate; top them up only if they're needed for the demo.

Next
- Review this gate. The open item closes with Phase 4: "deploy to mainnet", plus about 5 USDT worth of Base ETH and REACT, and the cap and beneficiary you approve.
- Phase 6 (hardening and documentation) when you ask for it.

## Phase 6 report: Hardening and documentation

Gate: NOT PASSED, one criterion open. "The mainnet vault has run 7+ days with real tx hashes in the usage table" needs Phase 4, which is parked until mainnet funds are available. CI is green, Slither is triaged and the README is in its final order. The README's video and mainnet sections are placeholders until Phases 7 and 4 fill them.

Built
- `Rulebook.withdrawReact(amount)`, owner only: pays any debt, then returns REACT to the owner and nobody else. This closes the Phase 3 open question about stranded REACT. Exposed as `make withdraw-react` (`WithdrawReact` in `script/ops/UserOps.s.sol`).
- Rulebook timers made `immutable` (`periodLength`, `claimInterval`, `silencePeriod`, `gracePeriod`, `guardianCheckInterval`), from Slither `immutable-states`.
- `SavingsVault`: the owner and executor checks each live in one internal function the modifiers call, the same pattern as OpenZeppelin and `AbstractPayer`.
- `docs/SECURITY.md`: what is checked, the Slither triage, trust assumptions, known limits.
- `README.md` in the PRD's order: what it is, video, tx-hash table (testnet; mainnet slot), mainnet usage, architecture (Mermaid diagram plus the contract table), safety limits (the seven invariants in plain words, the plain-ETH note, REACT running out), how to run (one deploy command per network, every everyday action, keeping a Rulebook funded, the app), deployed addresses.
- `docs/NOTES.md` §15: gas and REACT review.
- Makefile: fixed a literal `\n` in `.PHONY`. The one-command deploy targets already existed (`deploy-base-sepolia`, `deploy-base`, `deploy-rulebook-lasna`, `deploy-rulebook-reactive`), and each writes `contracts/deployments/<network>.json`. Mainnet targets refuse to run without `STEWARD_MAINNET_APPROVED`.
- The web app deploys the new Rulebook bytecode. Its byte-for-byte test now checks what it was meant to check: the page encodes the same constructor settings as the script, and it ships the current compiled bytecode.

Tests
- forge test: 124 passed, 1 skipped (fork test without `BASE_RPC`), 0 failed
- coverage of `src/`: 99.8% lines (420/421), 96.6% branches (85/88)
  - `OrdersExecutor`: 100% lines, 100% branches
  - `SavingsVault`: 100% lines, 100% branches
  - The three Rulebook items reported as missed are constructor reverts that have tests (`test_constructorValidatesConfig`, `test_constructorValidatesRule2AndGuardian`). Forge coverage doesn't record reverts inside a constructor.
- invariants: 1,000 runs × depth 50 (50,000 calls, 0 reverts), all seven holding
- frontend: lint, typecheck and format clean; Vitest 36 passed, 2 skipped (live)
- Slither 0.11.6: 3 High and 9 Medium, all false positives or intended, explained in `SECURITY.md`; 26 Low accepted; 5 optimizations applied
- Secrets: the deployer key is in no commit; the RPC URLs in history are keyless public endpoints; `.env` is ignored and untracked; the license is MIT

On-chain evidence
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| none new this phase | | | | |

Decisions and findings (NOTES §15, SECURITY.md)
- `withdrawReact` pays only the owner, not a `to` address as Phase 3 proposed, so no code path can send even REACT anywhere new. It is allowed at any time, because the REACT is the owner's own. Withdrawing below the running cost simply stops the rules, as running out would.
- The Rulebooks already deployed (the phone's two testnet ones and the Phase 3 runs) predate `withdrawReact`, so their leftover lREACT stays where it is. New Rulebooks, from the app or `make deploy-rulebook-*`, have it.
- Measured REACT use matches the Phase 1 model: ≈ 0.012 per delivered log plus callback fees; a quiet `Cron1000` day ≈ 1 lREACT. The Phase 5 test Rulebook (0.1 lREACT) ran out after 49 minutes, as expected.
- The release callback's single attempt is documented as a known limit, with the mitigation: keep the executor's ETH float funded and check it with `cast`. A beneficiary-triggered retry is left for later.

Risks and open questions
- **The 7-day mainnet run is the critical path.** Submission is Dec 4, so the mainnet vault must start by about Nov 26. Proposed default: run Phase 4 the day funds arrive.
- **The "Built on Reactive" badge is still text.** The official logotype isn't in the repo, and fetching it means downloading from Reactive's press kit. Proposed default: add it in Phase 7 if the press kit has an SVG, otherwise keep the text badge.
- **A public URL for the app** is needed for the Phase 7 "someone else sets up a vault" item. Proposed default: deploy `web/` to Vercel once the repo is public.

Next
- Review this gate. Its open item, and Phase 5's, close with Phase 4: say "deploy to mainnet" when you have about 5 USDT for Base ETH and REACT, and confirm the per-period cap, REACT amount, income sender and beneficiary.
- Phase 7 (video and submission) when you ask for it.
