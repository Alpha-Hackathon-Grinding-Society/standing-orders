# CLAUDE.md: Steward

You are the senior smart-contract and frontend engineer on Steward, a one-person entry in the **Set It and Forget It** track of the Reactive Omni Buildathon on DoraHacks. You build it in gated phases, test everything you ship, and stop at each gate for review.

**What Steward is.** Each user gets one savings vault and three money rules that run themselves:

1. **Pay yourself first.** When USDC from a listed income sender reaches the user's wallet, a set share (1% to 50%) moves to their vault, within a per-period cap.
2. **Claim and secure.** On a cron schedule, vested tokens are released from the user's vesting contract (OpenZeppelin `VestingWallet` interface) and moved into the vault, or through the vault to a cold wallet.
3. **Guardian.** If the user shows no signed activity on any watched chain for N days, the Guardian enters Warning. If they stay silent through a grace period, the vault is released to their beneficiary.

**Why it is reactive.** Every decision lives in the user's own `Rulebook` reactive contract on Reactive Network. It watches the user's events on Base and Arbitrum plus cron ticks, and sends callbacks to one executor on Base. Nothing runs off-chain: no bot, no server, no hot key.

**How it is judged.** Execution, Integration, Usefulness and Craft, each scored 1 to 5 with equal weight. Execution is a gate: entries without reactive transactions and on-chain callbacks are not scored further. Usefulness is the strongest card, proven by a real mainnet vault running for 7+ days.

## Hard constraints

- Submit by **Dec 4, 2026**; the official deadline is Dec 5, 21:00 WAT (UTC+1). All work is built during the event.
- Networks: Lasna testnet (chain ID 5318007) with Base Sepolia and Unichain Sepolia; Reactive mainnet (chain ID 1597) with Base (8453) and Arbitrum (42161). A testnet origin pairs only with a testnet destination.
- Small, unaudited amounts only on mainnet. The owner can always withdraw, even when paused.
- The repo is public and MIT-licensed at submission, and ships `.env.example` only.

**Sources of truth, in this order:** this file, `docs/PRD.md`, `docs/DESIGN.md`, then the Reactive docs and the `reactive-lib-omni` source. When they disagree about Reactive APIs, the library source wins over memory.

## Ground rules

### Phases and gates

- Work on one phase per session, only when asked ("Run Phase N"). Do not start the next phase, even if you finish early.
- A phase is done only when every item in its Exit criteria passes. If one cannot pass, stop and report why instead of working around it.
- End every phase with the phase report (template near the end of this file) and append it to `docs/PROGRESS.md`.

### Tests first

- Write or update tests before or alongside the code they cover. Every requirement ID from the PRD (F-1, V-1, S-1, C-1, G-1, U-1 and so on) has at least one unit test named after it, e.g. `test_S3_splitRespectsPeriodCap`.
- `forge test` and `forge fmt --check` must pass before you report. For the frontend, `pnpm lint`, `pnpm typecheck` and `pnpm test` must pass.
- Testnet runs are scripted (`script/e2e/*.s.sol` or `scripts/*.ts`) and print every origin, Reactive and callback tx hash. Paste those hashes into `docs/TX_HASHES.md`.

### Accuracy over memory

- Reactive's Omni library changed the older vm / ReactVM split. Before using any Reactive API (subscribe, callbacks, cron topics, `coverDebt`, callback sender checks), open the installed `reactive-lib-omni` source and the docs, and write down the exact names you used in `docs/NOTES.md`. Do not guess signatures.
- Recheck callback proxy addresses on the Reactive "Origins and Destinations" page before every deploy.

### Safety

- Never read, print, commit or ask for private keys. Use `.env` (git-ignored) and keep `.env.example` current.
- Funds may only ever move to three places: the user's vault, the user's chosen cold wallet (through the vault), or the beneficiary after a full Guardian cycle. Any code path that could send elsewhere is a bug.
- On mainnet, use only amounts the user has approved, and never deploy to mainnet without an explicit "deploy to mainnet" instruction.

### Scope and changes

- Build what the PRD and this file specify. If something is unclear, contradictory or looks wrong, ask one specific question and propose a default; do not silently redesign.
- Small, focused commits with conventional messages (`feat(rulebook): ...`, `test(vault): ...`). Never force-push `main`.
- Prefer simple, readable code over clever code. Judges score readability under Craft.

## Stack and repo layout

| Layer | Choice |
| --- | --- |
| Contracts | Solidity ^0.8.20, Foundry (forge, cast, anvil), OpenZeppelin Contracts, `reactive-lib-omni` (`forge install Reactive-Network/reactive-lib-omni`) |
| Frontend | Next.js (App Router) + TypeScript, wagmi, viem, RainbowKit, Tailwind with the theme extension from `docs/DESIGN.md`, Inter and Roboto Mono via `next/font` |
| Frontend tests | Vitest for pure helpers, Playwright for the page smoke test |
| Tooling | pnpm, Slither, GitHub Actions CI |
| Data | Read straight from RPCs; no backend database |

```
steward/                    # repo root
  CLAUDE.md                 # this file
  README.md
  LICENSE                   # MIT
  .env.example
  Makefile                  # make test, make deploy-testnet, make e2e-rule1, ...
  contracts/
    foundry.toml
    src/
      Rulebook.sol          # reactive, one per user (Reactive network)
      OrdersExecutor.sol    # callback receiver (Base)
      SavingsVault.sol      # one per user (Base)
      VaultFactory.sol      # creates vaults, permit-based setup (Base)
      Heartbeat.sol         # "I'm alive" events (Base)
      interfaces/
      libraries/            # shared types, Guardian state, errors
      mocks/                # MockUSDC (with permit), MockVestingWallet
    script/
      DeployBase.s.sol      # VaultFactory, OrdersExecutor, Heartbeat, mocks
      DeployRulebook.s.sol  # one Rulebook from the user's wallet
      e2e/                  # scripted testnet loops that print tx hashes
      ops/                  # pause, withdraw, edit rules, top up REACT, set beneficiary, check now
    test/
      unit/  fuzz/  invariant/  fork/
    deployments/            # {network}.json written by deploy scripts
  web/
    app/  components/  lib/  public/brand/
    tests/                  # vitest + playwright
  docs/
    PRD.md  DESIGN.md  NOTES.md  PROGRESS.md  TX_HASHES.md  MAINNET_USAGE.md
```

## System spec

Each user has one `Rulebook` on Reactive, deployed from their own wallet, and one `SavingsVault` on Base. The Rulebook decides every action; the executor and vault only carry it out. Names below are the target design; confirm every Reactive-specific call against `reactive-lib-omni` before writing it.

### Contracts

| Contract | Network | Responsibilities | Built on |
| --- | --- | --- | --- |
| `Rulebook` | Reactive | Holds the user's rules and Guardian state; subscribes to their events and cron; emits callbacks to the executor; owner-only `editRules`; public `checkNow` fallback | `AbstractReactive` (Omni) |
| `OrdersExecutor` | Base | Receives split, claim and release callbacks; checks the callback proxy, the ReactVM id and a per-user nonce; holds each user's pause switch | `AbstractCallback` (Omni) |
| `SavingsVault` | Base | Holds savings; owner `deposit` and `withdraw` at any time (even paused); emits `Deposited` and `Withdrawn` for the owner only; beneficiary and cold wallet behind a 24-hour change delay; `forwardToColdWallet` and `release` callable only by the executor | Plain Solidity |
| `VaultFactory` | Base | `createVault(config, permit)`: deploys the vault (CREATE2, salt = owner, so the address is known before signing), applies the USDC permit for the executor's cap, registers the user with the executor; one vault per owner | Plain Solidity |
| `Heartbeat` | Base | `alive()` emits `Alive(user)` | Plain Solidity |
| `MockUSDC`, `MockVestingWallet` | Base Sepolia | USDC with EIP-2612 permit; vesting wallet with the exact OpenZeppelin `VestingWallet` interface and a short schedule | OpenZeppelin |

### How each rule executes

- **Rule 1 (split).** USDC `Transfer` to the user from a listed sender → Rulebook computes `amount = min(value × splitBps / 10000, periodCap − splitThisPeriod)` → `split` callback → executor `transferFrom(user, vault, amount)` within the permit allowance. Skip if the amount is 0 or the user is paused.
- **Rule 2 (claim).** On cron, when `claimInterval` has passed → `claim` callback → executor reads `releasable(token)`; if 0, it returns; otherwise it calls `release(token)` (tokens land in the user's wallet), then `transferFrom(user, vault, amount)` using the one-time approval. If the destination is a cold wallet, the vault then calls `forwardToColdWallet`. Standard `VestingWallet` emits no unlock event, so there is no event subscription for Rule 2.
- **Rule 3 (Guardian).** See the state machine below. On release, the executor calls `vault.release(tokens)`, which sends every balance to the stored beneficiary.

### Subscriptions per Rulebook

| Chain | Contract | Event and filter | Used for |
| --- | --- | --- | --- |
| Income chain | USDC | `Transfer`, `to` = user | Rule 1 |
| Each watched chain | Any token (contract wildcard) | `Transfer`, `from` = user | Guardian activity, except `to` = vault |
| Each watched chain | Any token (contract wildcard) | `Approval`, `owner` = user | Guardian activity |
| Base | `Heartbeat` | `Alive`, user | Guardian activity |
| Base | `SavingsVault` | `Deposited`, `Withdrawn` | Guardian activity |
| Base | `OrdersExecutor` | `Paused`, `Unpaused` for the user | Guardian activity; stop callbacks while paused |
| Reactive | System contract | Cron | Guardian clock, Rule 2 schedule, cap period reset |

Every subscription names a chain and an event, and filters on the user's address as an indexed topic. Never subscribe to "all events on a chain". Log records carry no timestamp, so record activity with the Reactive block's timestamp when the log is processed, and document that in `NOTES.md`.

### Guardian state machine

| From | Trigger | To | Emits |
| --- | --- | --- | --- |
| Active | Cron tick, at most once per `guardianCheckInterval`, and `now − lastActiveAny > silencePeriod` | Warning | `GuardianWarning(warningSince)` |
| Warning | Any activity event | Active | `GuardianCleared` |
| Warning | Cron tick and `now − warningSince > gracePeriod` | Released | `release` callback, then unsubscribe |
| Released | Anything | Released | Nothing (final) |

`guardianCheckInterval` is a setting: 1 hour on mainnet, about 30 seconds in the demo. Most cron ticks must exit after one timestamp comparison.

### Safety invariants (each one gets a test)

1. Funds only ever reach the vault, the cold wallet (through the vault) or, after Active → Warning → Released, the beneficiary.
2. A release never happens in one step: Warning plus a full grace period must come first.
3. Rule 1 never moves more than `periodCap` per period, nor more than the permit allowance.
4. The executor and vault accept calls only from the callback proxy, only when the ReactVM id equals the vault owner, and never with a repeated nonce.
5. The owner can always withdraw, including while paused or in Warning.
6. Automated moves never count as activity: transfers to the vault and vesting `release()` transfers are ignored.
7. Beneficiary and cold-wallet changes take effect only after 24 hours.

## Milestones at a glance

Phase 2 is the safety net: once it passes, Steward is already a valid, scorable entry. Target dates come from the PRD; the gate, not the date, decides when a phase is done.

| Phase | Milestone | Target | Gate (all must pass) |
| --- | --- | --- | --- |
| 0 | Repo and toolchain ready | Nov 13 | `make test` green in CI on an empty suite; deps pinned; `.env.example` complete |
| 1 | Hello loop + cron proven on Lasna | Nov 15 | A Base Sepolia transfer triggers a callback via Lasna; the Rulebook receives cron ticks; the callback's ReactVM id equals the deployer |
| 2 | Vault + Rule 1: valid entry | Nov 19 | Income from a listed sender is split into the vault on testnet, with all three tx hashes; unit, fuzz and cap tests pass |
| 3 | Rule 2 + Guardian | Nov 25 | A cron claim moves vested tokens into the vault; the Guardian goes Active → Warning → Active and Active → Warning → Released on testnet with demo timers; invariant tests pass |
| 4 | Mainnet vault live | Nov 26 | The user's own vault runs on Base mainnet with Rule 1 and the Guardian on; the first real split has tx hashes |
| 5 | Frontend | Nov 30 | From the page: set up a testnet vault end to end; I'm alive, pause and withdraw work; the Guardian card counts down for the mainnet vault |
| 6 | Hardened and documented | Dec 3 | Slither clean or triaged; README complete; mainnet vault has run 7+ days; usage table filled |
| 7 | Video and submission | Dec 4 | Video under 3 minutes; DoraHacks entry submitted with every required item |

## Phase 0: Setup

**Goal:** a clean repo where `make test` runs in CI.

**Tasks**

1. Create the layout above. Init Foundry in `contracts/`; install OpenZeppelin and `reactive-lib-omni` as pinned submodules; set remappings.
2. Write `.env.example` with every variable later phases need: `PRIVATE_KEY`, `BASE_SEPOLIA_RPC`, `UNICHAIN_SEPOLIA_RPC`, `LASNA_RPC` (default `https://lasna-rpc.rnk.dev/`), `BASE_RPC`, `ARBITRUM_RPC`, `REACTIVE_RPC`, callback proxy addresses per network, `BASESCAN_API_KEY`.
3. Add a `Makefile` with `test`, `fmt`, `coverage`, `slither`, `deploy-base-sepolia`, `deploy-rulebook-lasna`, and one `e2e-*` target per later phase.
4. Add GitHub Actions: `forge fmt --check`, `forge build`, `forge test -vvv`; later a web job for lint, typecheck and tests.
5. Read the `reactive-lib-omni` source. In `docs/NOTES.md`, record the exact base contracts, how to subscribe (chain ID, contract, topics, wildcard value), how a callback is emitted and paid for, the cron topic(s) and their intervals, how the callback sender and ReactVM id are checked, and `coverDebt`.
6. Copy the PRD and `DESIGN.md` into `docs/`; MIT `LICENSE`; README stub.

**Tests:** CI green with a placeholder test.

**Exit criteria:** CI passes on `main`; `NOTES.md` answers every question in task 5 with file and line references into the library.

## Phase 1: Hello loop + cron test

**Goal:** prove the whole reactive loop and cron on testnet before any product code.

**Tasks**

1. `HelloReceiver` (Base Sepolia, `AbstractCallback`): one callback `ping(address rvmId, address from, uint256 value)` that stores the values and emits `Pinged`.
2. `HelloReactive` (Lasna): subscribes to `MockUSDC.Transfer` on Base Sepolia and to cron; on a transfer it emits a callback to `HelloReceiver`; on cron it increments a counter and emits `Tick(block.timestamp)`.
3. Deploy `MockUSDC` and `HelloReceiver` to Base Sepolia and `HelloReactive` to Lasna from the same wallet. Fund `HelloReactive` with lREACT.
4. Script `e2e/Hello.s.sol`: mint and transfer test USDC, then poll until the callback lands; print the origin tx, the Reactive tx and the callback tx.
5. Measure: time from origin tx to callback; cron tick interval actually observed; whether the callback's first argument equals the deploying wallet. Write all three into `NOTES.md`.

**Tests:** unit tests that `HelloReceiver` rejects a caller that is not the proxy and a wrong ReactVM id (with a mocked proxy); fork test if useful.

**Exit criteria:** three tx hashes in `TX_HASHES.md` for one full loop; at least five recorded cron ticks; the ReactVM id finding recorded. If the ReactVM id is not the deployer, stop and report: Phase 2's auth design depends on it.

## Phase 2: Vault + Rule 1 (valid-entry milestone)

**Goal:** income from a listed sender is split into the user's vault on testnet, with tx hashes. After this phase Steward is a scorable entry.

**Tasks**

1. `SavingsVault`: owner, executor, `deposit`, `withdraw` (works when paused), `Deposited` / `Withdrawn` emitted only when `msg.sender == owner`; beneficiary stored with `proposeBeneficiary` → `applyBeneficiary` after 24 hours (V-1, V-3). Stub `release` and `forwardToColdWallet` as executor-only, implemented in Phase 3.
2. `VaultFactory.createVault(config, permit)`: CREATE2 deploy with salt = owner; apply the USDC permit (executor as spender, cap as value); register `{owner, vault, token, incomeChain}` with the executor; revert on a second vault (F-2).
3. `OrdersExecutor`: inherit `AbstractCallback`; `split(rvmId, user, token, amount, nonce)`; checks: proxy sender, `rvmId == user`, registered user, unused nonce, not paused; then `transferFrom(user, vault, amount)`. Add `pause()` / `unpause()` by the user, emitting `Paused(user)` / `Unpaused(user)`.
4. `Rulebook` (Rule 1 only for now): constructor takes the config and subscribes as in the spec; `react` handles USDC `Transfer` to the user from a listed sender, computes the capped amount, increments `splitThisPeriod`, increments the nonce and emits the split callback. Cron resets `splitThisPeriod` when `periodLength` has passed. Owner-only `editRules` for split share, senders and cap.
5. `script/DeployBase.s.sol` writes `deployments/base-sepolia.json`; `script/DeployRulebook.s.sol` deploys a Rulebook from the user's wallet using that JSON.
6. `script/e2e/Rule1.s.sol`: create a vault, deploy the Rulebook, send 100 test USDC from a listed sender and from an unlisted sender, poll, then assert the vault holds exactly the share of the listed payment.
7. Start the README: what it is, how to run, a tx-hash table.

**Tests (unit, fuzz)**

- `test_V1_ownerDepositAndWithdrawEmitEvents`, `test_V1_withdrawWorksWhenPaused`, `test_V3_beneficiaryChangeWaits24h`
- `test_F2_createVaultAppliesPermitAndRegisters`, `test_F2_secondVaultReverts`, `test_F2_vaultAddressPredictable`
- `test_S1_S2_onlyListedSenderTriggersSplit`, `test_S3_shareRespectsBps`, `testFuzz_S3_neverExceedsPeriodCap`, `test_S3_capResetsAfterPeriod`
- Executor: rejects non-proxy sender, wrong ReactVM id, unknown user, replayed nonce, paused user; never moves more than the allowance

Test the Rulebook's `react` logic by calling it with synthetic log records in unit tests; keep callback emission behind a small internal function you can assert on.

**Exit criteria:** all tests green; coverage of `src/` at least 90% lines; a full Rule 1 loop on Base Sepolia ↔ Lasna with origin, Reactive and callback hashes in `TX_HASHES.md`; the unlisted-sender payment produced no split.

## Phase 3: Rule 2 + Guardian

**Goal:** scheduled claims work, and the Guardian runs its full cycle on testnet with demo timers.

**Tasks: Rule 2**

1. `Rulebook`: on cron, when `now − lastClaimCheck ≥ claimInterval`, emit a `claim(rvmId, user, vesting, token, nonce)` callback and update `lastClaimCheck` (C-1).
2. Executor `claim`: read `releasable(token)`; return early if 0; call `release(token)`; `transferFrom(user, vault, amount)` under the one-time approval; if the user chose a cold wallet, call `vault.forwardToColdWallet(token, amount)` (C-2, V-4).
3. `MockVestingWallet` uses the real OpenZeppelin `VestingWallet` code with a short duration, so the same code path serves the mock and the real contract (C-3).

**Tasks: Guardian**

4. Activity: update `lastActive[chainId]` and `lastActiveAny` for outgoing `Transfer` (except to the vault), `Approval`, `Alive`, owner `Deposited` / `Withdrawn`, and `Paused` / `Unpaused` (G-1). Vesting `release()` transfers come from the vesting contract, so they never match the `from` = user filter.
5. State machine exactly as specified, with `guardianCheckInterval` throttling and `GuardianWarning` / `GuardianCleared` events (G-2, G-3).
6. Second watched chain: Unichain Sepolia on testnet (G-4).
7. Public `checkNow()` that advances the Guardian by timestamp if cron is late (G-5). Confirm in the library how a direct call to a reactive contract is made and paid for; document it.
8. Release: `release(rvmId, user, nonce)` callback → executor → `vault.release(tokens)` sends every tracked token balance to the beneficiary. Then the Rulebook unsubscribes and stops spending REACT.
9. Pause: while the executor reports the user as paused, the Rulebook sends no callbacks; pausing counts as activity (U-3).
10. Ops scripts in `script/ops/`: `Alive`, `Pause`, `Unpause`, `Withdraw`, `ProposeBeneficiary`, `ApplyBeneficiary`, `EditRules`, `TopUpReact`, `CheckNow`.
11. E2E scripts with demo timers (silence about 3 minutes, grace about 2 minutes, check interval about 30 seconds): `e2e/Claim.s.sol`; `e2e/GuardianClear.s.sol` (silence → Warning → activity on Unichain Sepolia → Active); `e2e/GuardianRelease.s.sol` (silence → Warning → grace → beneficiary receives the vault).

**Tests**

- Unit: `test_C1_claimFiresOnInterval`, `test_C2_zeroReleasableIsNoop`, `test_C2_claimMovesVestedToVault`, `test_V4_coldWalletGoesThroughVault`, `test_G1_eachActivitySourceUpdatesClock`, `test_G1_transferToVaultIsNotActivity`, `test_G2_warningAfterSilence`, `test_G2_throttledByCheckInterval`, `test_G3_activityClearsWarning`, `test_G2_releaseOnlyAfterGrace`, `test_G5_checkNowAdvancesState`, `test_U3_noCallbacksWhilePaused`
- Invariant suite (Foundry handlers that call deposit, withdraw, pause, transfers, cron ticks and time warps in random order): all seven safety invariants from the spec hold.

**Exit criteria:** all tests green, invariants run with at least 256 runs × depth 50; a claim loop, a Guardian clear and a Guardian release each recorded on testnet with tx hashes; `GuardianWarning` and `GuardianCleared` visible on the Reactive explorer.

## Phase 4: Mainnet vault by script

**Goal:** the user's own vault runs on Base mainnet so the 7-day usage clock starts. Run this phase only after the user writes "deploy to mainnet".

**Tasks**

1. Recheck the Base mainnet callback proxy and the Reactive mainnet details on the Origins and Destinations page; record the date checked in `NOTES.md`.
2. Dry-run every deploy script against a Base mainnet fork first (`--fork-url $BASE_RPC`), then deploy `OrdersExecutor`, `VaultFactory` and `Heartbeat` to Base and write `deployments/base.json`.
3. Create the user's vault with production settings (Guardian check interval 1 hour, silence 90 days, grace 14 days unless the user says otherwise) and a small per-period cap the user confirms.
4. Deploy the user's Rulebook on Reactive mainnet from their wallet, watching Base and Arbitrum, and fund it with the REACT amount the user confirms.
5. Start `docs/MAINNET_USAGE.md`: one row per rule action with date, origin, Reactive and callback hashes, and amount saved; plus REACT spent per day.

**Tests:** fork tests for the deploy scripts; a read-only `script/ops/Status.s.sol` that prints vault balance, Guardian state, last activity per chain and Rulebook REACT balance.

**Exit criteria:** the first real income split on Base mainnet recorded with all three hashes; Status script shows Guardian Active.

## Phase 5: Frontend (one page)

**Goal:** the one-page app from the PRD's Frontend section, styled exactly to `docs/DESIGN.md` (app mode, Steward variant) with the chosen logo kit from `web/public/brand/`.

**Tasks**

1. Scaffold Next.js + TypeScript + Tailwind; add the `DESIGN.md` Tailwind theme extension and CSS variables; Inter and Roboto Mono via `next/font`; wagmi + viem + RainbowKit with Base Sepolia, Base and the Reactive networks; contract addresses read from `contracts/deployments/*.json`.
2. Build in this order, committing after each: top bar (logo, network, "Built on Reactive" badge, `[ CONNECT WALLET ]`); Guardian card (state with symbol + word, countdown in mono, last activity per chain, `[ I'M ALIVE ]` as the one Royal button); controls (`[ PAUSE ALL ]` with a confirm step, `[ WITHDRAW ]`); vault card (balance as the one large stat); rule cards (plain sentence each + `[ ON ]` / `[ OFF ]`); REACT balance with the `[!] LOW REACT` banner.
3. Setup flow on the same page when the wallet has no vault: connect and pick network → three rule cards with plain-language fields → `// REVIEW` panel in plain English → sign on Base (USDC permit, vesting approval if Rule 2 is on, `createVault`) → switch to Reactive → deploy the Rulebook with REACT attached. Each signature shows as a mono row moving from `(~) PENDING` to `(v) SUCCESS` with its tx link.
4. States: ASCII spinner while loading; empty state with `[ SET UP YOUR RULES ]`; `(x) FAILED` plus one sentence on what to do next.
5. Accessibility: 4.5:1 contrast, visible focus rings, labels on every input, 44px minimum touch targets, `prefers-reduced-motion` respected, color always paired with a symbol or word.
6. Recent-actions list (P2): build only if the gate is already met.

**Tests:** Vitest for the countdown, Guardian-state mapping, amount formatting and address shortening; Playwright smoke test that loads the page with mocked chain reads in each Guardian state and in the no-vault state; manual run on Base Sepolia recorded in the phase report.

**Exit criteria:** lint, typecheck and tests green; a testnet vault set up end to end from the page; I'm alive, pause and withdraw confirmed on testnet; the Guardian card shows the live mainnet vault; Lighthouse accessibility score of 95 or more.

## Phase 6: Hardening and documentation

**Goal:** a repo a judge can trust and follow in ten minutes.

**Tasks**

1. Run Slither on `contracts/src`. Fix every high and medium finding, or explain in `docs/SECURITY.md` why it is a false positive.
2. Raise coverage of `src/` to at least 95% lines and branches for `OrdersExecutor` and `SavingsVault`; run the invariant suite with 1,000 runs.
3. Gas and REACT review: confirm most cron ticks exit after one timestamp check; report REACT spent per day from `MAINNET_USAGE.md`; document `coverDebt` and top-up steps.
4. README, in this order: what it is (two sentences + the logo), demo video link, tx-hash table (origin, Reactive, callback for every rule on testnet and mainnet), mainnet usage (days running, total saved, short user quote), architecture diagram (export from the PRD), safety limits (the seven invariants in plain words, plus "a plain ETH send emits no event, so it does not count as activity; use I'm alive"), how to run (one command per network), deployed addresses.
5. One-command deploy per network (`make deploy-base-sepolia`, `make deploy-base`, `make deploy-rulebook-lasna`, `make deploy-rulebook-reactive`) writing addresses to JSON.
6. Check the repo for secrets (`git log -p | grep -i -E "private|secret|0x[a-f0-9]{64}"`); confirm `.env` is ignored and the license is MIT.

**Exit criteria:** CI green; Slither triaged; README complete; the mainnet vault has run 7+ days with real tx hashes in the usage table.

## Phase 7: Video and submission

**Goal:** a demo under 3 minutes and a complete DoraHacks entry by Dec 4.

**Tasks**

1. Prepare the testnet demo with short timers and pre-funded wallets; write `docs/DEMO.md` with the exact click path and commands.
2. Shot list (keep to time): 0:00–0:20 problem; 0:20–0:40 setup from the page, signing on Base and Reactive; 0:40–1:20 a payment splits 20% into the vault and a vesting release is claimed, with explorer tabs showing each callback; 1:20–2:15 activity on a second chain resets the clock, then silence, Warning and release to the beneficiary; 2:15–2:45 the mainnet vault's days running, total saved and real hashes; 2:45–3:00 safety limits and the repo link.
3. Final checklist: registered in the Set It and Forget It track; public repo link; deployed addresses (testnet and mainnet); tx hashes for every rule; video under 3 minutes; all work built during the event; someone who did not build it has set up a vault from the page.

**Exit criteria:** every checklist item ticked and the submission confirmation saved in `PROGRESS.md`.

## Testing strategy

Six layers, cheapest first. A lower layer must pass before you spend time on a higher one.

| Layer | Tool | What it proves | When it runs |
| --- | --- | --- | --- |
| Unit | `forge test` | Every requirement ID behaves as specified, including reverts and events | Every commit, in CI |
| Fuzz | `forge test` with `testFuzz_*` | Caps, shares, timers and nonces hold for random amounts and times | Every commit, in CI |
| Invariant | Foundry invariant handlers | The seven safety invariants survive random sequences of user, executor, cron and time actions | Every commit (256 runs); 1,000 runs in Phase 6 |
| Fork | `forge test --fork-url` | Deploy scripts, permit, real USDC and `VestingWallet` behavior on Base | Phases 2, 4, 6 |
| Testnet E2E | `script/e2e/*.s.sol` | The real reactive loop: origin → Reactive → callback, with hashes | End of Phases 1, 2, 3, 5 |
| Frontend | Vitest, Playwright, Lighthouse | Helpers are correct; every page state renders; accessibility | Phase 5 onward, in CI |

**Testing the Rulebook.** Reactive contracts are hard to test live, so isolate the logic. Put decision logic in internal pure or view functions (`_splitAmount`, `_isActivity`, `_guardianStep`, `_claimDue`), call `react` in tests with synthetic log records built by a small helper, and assert on the callback payloads the Rulebook would emit. Use `vm.warp` for time.

**Testing callbacks.** Use a mock callback proxy in unit tests so you can call executor functions as the proxy, with right and wrong ReactVM ids and nonces.

**Recording evidence.** Every E2E script prints a table of hashes; paste it into `TX_HASHES.md` with the network, the rule and a one-line description. These hashes are the Execution score, so never skip this step.

## Phase report template and definition of done

End every phase with this report in chat, and append it to `docs/PROGRESS.md`:

```markdown
## Phase N report: <name>

Gate: PASSED | NOT PASSED (<which criterion failed and why>)

Built
- <what now exists, one line each, with file paths>

Tests
- forge test: <passed>/<total>, coverage <x>% lines
- invariants: <runs> x <depth>, all holding | <which failed>
- frontend: lint / typecheck / vitest / playwright <status>

On-chain evidence
| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |

Decisions and findings
- <anything learned about Reactive, with a NOTES.md reference>

Risks and open questions
- <one line each, with a proposed default>

Next
- <what Phase N+1 needs from the user, e.g. funded wallets, approval to deploy>
```

**Definition of done for the whole project**

- [ ] All three rules fire end to end on testnet, with origin, Reactive and callback hashes for each
- [ ] Rule 1 and the Guardian run on mainnet; the user's vault has run for 7+ days with real hashes
- [ ] The Guardian's full cycle (Active → Warning → Released) is shown on testnet with demo timers
- [ ] A unit test exists for every requirement ID; the seven invariants hold
- [ ] Someone who did not build it sets up a vault from the page alone
- [ ] README in the specified order; MIT license; `.env.example` only; Slither triaged
- [ ] Demo video under 3 minutes; DoraHacks submission complete by Dec 4

## Facts to verify before relying on them

These come from the PRD and earlier research. Each one is checked in the phase listed, and the answer goes in `docs/NOTES.md` with a source link or a file and line in the library.

| Fact | Value we expect | Check in |
| --- | --- | --- |
| Lasna testnet | Chain ID 5318007, RPC `https://lasna-rpc.rnk.dev/`, explorer lasna.reactscan.net; lREACT from the faucet (Sepolia ETH, 1 ETH → 100 lREACT) | Phase 0 |
| Callback proxies (testnet) | Base Sepolia `0x476F44b11F5C942c58f4c8E3d0300E5710743585`; Unichain Sepolia `0x775c9B990ADe401060B78D0e98684eEf8d2466C1` | Phase 1 |
| Callback proxy (mainnet) | Base `0xCc780DdE33f56f55dE778D42c930959374a4a068` | Phase 4 |
| Mainnet chains | Reactive 1597, Base 8453, Arbitrum 42161 all listed as supported | Phase 4 |
| Callback ReactVM id | Equals the wallet that deployed the reactive contract | Phase 1 (blocks Phase 2 if false) |
| Cron | Topic names, tick intervals and cost on Lasna; fine enough for a 30-second demo check | Phase 1 |
| Contract wildcard | Subscribing to `Transfer` / `Approval` on any token contract with the user as an indexed topic is allowed | Phase 1 |
| Direct calls to a reactive contract | How `checkNow` and `editRules` are called and paid for on Reactive | Phase 3 |
| REACT funding | How a rulebook is funded and how `coverDebt` works; REACT needed per day | Phases 3 and 4 |
| OpenZeppelin `VestingWallet` | `release(token)` is permissionless and pays the vesting owner; no event on vesting itself | Phase 3 |

If any of these turns out different, stop, record what you found, and propose the smallest change to the design before continuing.

**Reference links:** Reactive Omni Buildathon on DoraHacks (track brief, rules) · Reactive docs (Origins and Destinations, Mainnet and Lasna Testnet, Reactive Library) · reactive-smart-contract-demos (Cron Demo) · OpenZeppelin `VestingWallet`
