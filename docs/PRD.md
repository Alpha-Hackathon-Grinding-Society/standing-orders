# Steward: Product Requirements Document

Nov 12, 2026 · Adedokun Daniel Adewole

> Markdown transcription of `docs/Steward-PRD.pdf`. The architecture diagram (p. 8), page wireframe (p. 12) and build-plan chart (p. 18) live in the PDF.

## Overview

Steward gives each user one savings vault and three money rules that run themselves: income is split, unlocked tokens are saved, and if the user goes silent on every chain, their savings reach a person they chose. We are entering it in the **Set It and Forget It** track of the Reactive Omni Buildathon to win the $2,000 first prize.

The three rules cover the life of the user's money: they **earn** it, **save** it, and it is **protected** if something happens to them.

1. **Pay yourself first.** When income arrives in the wallet, a set share moves to the savings vault.
2. **Claim and secure.** When tokens unlock from a vesting contract, a scheduled check claims them and sends them to the vault or a cold wallet.
3. **Guardian.** If the user shows no activity on any watched chain for N days, they get a warning. If they stay silent through a grace period, the vault goes to their beneficiary.

| Fact | Detail |
| --- | --- |
| Event | Reactive Omni Buildathon on DoraHacks, virtual |
| Track | Set It and Forget It: build something useful for yourself, on any supported chain |
| Prize | $2,000 first place, $250 runner-up, paid in REACT |
| Deadline | Dec 5, 2026, 21:00 WAT (UTC+1) |
| Networks | Reactive mainnet or Lasna testnet, with any Reactive-supported chain |
| What judges look for | A tool we'd actually keep running, a clear personal purpose, a creative take on event-driven logic |
| Judging | Execution, Integration, Usefulness, Craft; each scored 1 to 5, equal weight |
| Sister project | Reflex, our Every Second Counts entry. Reflex is the main focus; Steward is a one-person build |

The pitch in one line: *set your money rules once; income gets split, unlocks get saved, and if you go silent everywhere, your savings reach the person you chose.*

## Problem

People who earn and hold crypto rely on willpower and memory for three things that should be automatic, and a lapse in any of them costs money.

- **Saving doesn't happen.** Income lands in the same wallet that pays for everything, so the "save 20%" plan gets skipped. Banks solved this decades ago with standing orders; most wallets have nothing like it.
- **Unlocked tokens sit unclaimed or get spent.** Vesting, staking rewards and airdrops unlock on their own schedule. People forget to claim, miss claim windows, or claim and then spend.
- **Crypto can be lost for good when its owner disappears.** If someone dies or loses access, their family often can't reach the funds. Most people never set up any plan for this.

Today's fixes all need something running off-chain: a bot, a server, or a hot private key. A reactive contract can watch the user's own events across chains and act on-chain, with nothing to keep online. That is exactly what the track brief asks for: a personal tool you set up once and keep running.

## Goals, non-goals and success metrics

The goal is a 5 out of 5 on every criterion, with Usefulness as our strongest card. Execution is still a gate: entries without reactive transactions and their on-chain callbacks are not scored further.

**Goals**

- All three rules fire end to end on testnet, with tx hashes for each.
- I run my own vault on mainnet with small amounts for the final 8 days, proving "a tool you'd actually keep running."
- A non-developer can set up their rules through a form in under 5 minutes.
- The rules work together as one product: one rulebook, one vault, one setup.

**Non-goals**

- Moving tokens between chains. We don't build a bridge; the cross-chain part is the Guardian watching activity on several chains.
- Large amounts or real third-party users. Mainnet use stays with my own vault (plus a friend's, if one volunteers) and small sums.
- Legal inheritance. The Guardian is a technical safety net, not a will.
- Support for every vesting contract. We support one standard pattern plus our own mock.

**Success metrics by judging criterion**

| Criterion | What judges look for | Our target | How we prove it |
| --- | --- | --- | --- |
| Execution | Reactive transactions and their callbacks on-chain | All 3 rules fire on testnet; Rules 1 and 2 also fire on mainnet | README table of origin, Reactive and callback tx hashes |
| Integration | The reactive contract does real work, not bolted on | One rulebook per user decides everything; rules share the vault; Guardian watches several chains | Architecture diagram and rule logic walkthrough |
| Usefulness | Solves a problem real users have | I use it with my own money for at least 7 days | Mainnet tx history, a short note on what it did for me, plus a quote from any friend who ran a vault |
| Craft | Readable code, working demo, docs others can follow | Tests for every rule, one-command deploy, form-based setup, video under 3 minutes | CI run, README, video |
| Track brief | A tool you'd keep running, clear personal purpose, creative event logic | Guardian reacts to the absence of events across chains | Demo of the warning and release |

## Users and user stories

The main user is someone who earns or holds crypto and wants their money handled sensibly without thinking about it. The beneficiary and the judges are the other two audiences.

| User | Need | User story |
| --- | --- | --- |
| Freelancer or remote worker paid in USDC | Save without relying on willpower | As a freelancer, when a client pays me, I want 20% moved to savings automatically so I never skip it. |
| Token holder with vesting or staking rewards | Never miss or waste an unlock | As a holder, when my tokens unlock, I want them claimed and saved at once so they don't sit idle or get spent. |
| Anyone with savings in crypto | A plan if they disappear | As a saver, if I'm silent on all my chains for 90 days, I want a warning first and then my savings sent to my sister. |
| Beneficiary | Receive funds without technical steps | As a beneficiary, I want the funds to simply arrive in my wallet, with no keys or forms needed. |
| Non-developer | Set it up without code | As someone who has never written a contract, I want to set my rules through a simple form. |
| Judge | Verify it works and is really used | As a judge, I want tx hashes, a week of real mainnet use, and a short video. |

Acceptance for every story: after setup the user does nothing, and the result shows up as an on-chain callback. The user can pause, change or withdraw at any time.

## How it works: a month in the life of one user

Ada is a freelance designer paid in USDC on Base. She also has tokens vesting from an earlier job. This is what happens after a 5-minute setup.

1. **Setup (day 1).** Ada fills in the form: save 20% of payments from her two clients' addresses; claim her vesting tokens into the vault; Guardian after 90 days of silence, with a 14-day grace period, beneficiary is her sister. On Base she signs a USDC permit for her spending cap, approves her vesting token once, and sends one transaction that creates her vault. On Reactive she sends one transaction that deploys her personal rulebook from her own wallet with a little REACT attached.
2. **Pay yourself first (day 3).** A client pays 1,000 USDC. Her rulebook sees the `Transfer`, checks the sender is on her income list, and calls the executor, which moves 200 USDC into her vault. She did nothing.
3. **Claim and secure (day 10).** Her daily claim check runs on a cron tick. The executor finds tokens releasable, calls `release()` on her vesting contract, and moves them from her wallet into the vault in the same transaction.
4. **Normal life (days 1 to 30).** Ada sends payments and swaps on Base and Arbitrum. Each outgoing transaction she signs resets her Guardian clock on every chain. The automatic split and claim do **not** reset it.
5. **If she goes silent.** Suppose Ada stops all activity. On day 90 of silence the Guardian enters **Warning**: the dashboard and an on-chain event flag it, and any action from her cancels it.
6. **Release.** If 14 more days pass with no activity, the Guardian releases the vault to her sister's wallet. Ada can withdraw or cancel at any point before this.

For the demo we shrink the times to minutes (for example, 3 minutes of silence and a 2-minute grace period) so judges see the whole cycle in the video.

## Functional requirements

P0 must ship for a valid entry, P1 makes it a winning entry, and P2 is cut first. Rule 1 on testnet with the vault is already a scorable submission.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| F-1 | Deploy | The setup form deploys one `Rulebook` reactive contract per user from the user's own wallet, so every callback carries that wallet as its ReactVM id | P0 |
| F-2 | Deploy | `VaultFactory` on Base creates each user's `SavingsVault` and registers it with the executor, in one transaction that uses a USDC permit for the spending cap | P0 |
| V-1 | Vault | The owner can deposit and withdraw at any time; owner deposits and withdrawals emit `Deposited` and `Withdrawn`, which count as activity | P0 |
| V-2 | Vault | Only the executor can move funds out to the beneficiary, and only on a Guardian release | P0 |
| V-3 | Vault | The beneficiary is stored in the vault; a change takes effect only after 24 hours | P1 |
| V-4 | Vault | When the claim destination is a cold wallet, the vault forwards claimed tokens there, so the move never comes from the user's wallet | P1 |
| S-1 | Rule 1: split | Watches USDC `Transfer` events into the user's wallet | P0 |
| S-2 | Rule 1: split | Splits only transfers from senders on the user's income list | P0 |
| S-3 | Rule 1: split | Moves the set share (1% to 50%) to the vault via the executor, within a per-period cap | P0 |
| S-4 | Rule 1: split | Supports more than one token (e.g. USDC and USDT) | P2 |
| C-1 | Rule 2: claim | Runs a claim check on cron at the user's claim interval (daily on mainnet, minutes in the demo); no unlock event is needed | P0 |
| C-2 | Rule 2: claim | In one callback the executor calls `release()` when anything is releasable, then pulls those tokens from the user's wallet into the vault under a one-time approval; it does nothing when the amount is zero | P0 |
| C-3 | Rule 2: claim | Works with OpenZeppelin `VestingWallet`; our mock copies its interface, so both run through one code path | P1 |
| G-1 | Rule 3: Guardian | Records the time of the user's last signed activity on each watched chain | P0 |
| G-2 | Rule 3: Guardian | Uses cron events to check silence at most once per Guardian check interval (1 hour on mainnet, 30 seconds in the demo); moves Active → Warning → Released by timestamps | P0 |
| G-3 | Rule 3: Guardian | Any user activity during Warning returns the state to Active | P0 |
| G-4 | Rule 3: Guardian | Watches at least two chains (e.g. Base and Arbitrum on mainnet; Base Sepolia and Unichain Sepolia on testnet) | P1 |
| G-5 | Rule 3: Guardian | A public "check now" function as a fallback if cron is unavailable | P1 |
| U-1 | Setup | A form that creates the vault and rulebook with no code: a permit signature and one transaction on Base, then one transaction on Reactive | P1 |
| U-2 | Dashboard | Shows vault balance, Guardian state and countdown, and REACT balance; the recent-actions list with explorer links is P2 | P1 |
| U-3 | Dashboard | "I'm alive" button and pause switch, both on Base; pausing and unpausing count as activity, and the rulebook sends no callbacks while paused | P0 |
| U-4 | Alerts | Warning shown in the dashboard; optional Telegram or email alert from an off-chain listener | P2 |
| U-5 | Scripts | A Foundry script for every action: setup, I'm alive, pause, withdraw, edit rules, top up REACT, change beneficiary, check now | P0 |
| U-6 | Design | The page follows DESIGN.md app mode, Steward variant (see Frontend) | P1 |

## Architecture

Each user gets a personal `Rulebook` on Reactive and a `SavingsVault` on Base. The Rulebook watches the user's events on Base and Arbitrum, plus cron ticks, and sends every instruction to one executor.

*Diagram: see `Steward-PRD.pdf`, page 8 ("Each user's Rulebook watches their events and tells the executor what to do").*

- **Base + Arbitrum (origins):** USDC token (emits `Transfer` to you from your income senders); vesting contract (no unlock event: executor releases it on a cron check); your own activity (transfers you send, approvals you sign, I'm alive, vault, pause).
- **Reactive:** `Rulebook`, one per user: Rule 1 split income, Rule 2 claim on cron, Rule 3 Guardian; last activity per chain; Active, Warning, Released; decides every action. The system contract emits cron ticks.
- **Base (destination):** `OrdersExecutor` receives split, claim and release callbacks → moves funds → `SavingsVault` (your savings, withdraw any time) → on release only → beneficiary (the person you chose receives on release).

Grey arrows are events the Rulebook watches, or funds moving on Base; the dashed arrow is the callback from Reactive. Money only moves to the vault, a chosen cold wallet, or, after a full Guardian cycle, the beneficiary.

| Contract | Network | Role | Built on |
| --- | --- | --- | --- |
| `Rulebook` | Reactive | Deployed by the setup form from the user's own wallet; subscribes to the user's events and cron; holds rules and Guardian state; sends callbacks | `AbstractReactive` (`reactive-lib-omni`) |
| `VaultFactory` | Base | Creates each user's `SavingsVault` and registers it with the executor, using a USDC permit so it is one transaction | Plain Solidity |
| `OrdersExecutor` | Base | Pulls the split within the approved cap, releases and pulls vested tokens, releases the vault; holds each user's pause switch; accepts a callback only when its ReactVM id is the vault owner | `AbstractCallback` |
| `SavingsVault` | Base | Holds the user's savings; owner can withdraw any time; emits `Deposited` and `Withdrawn`; stores the beneficiary behind a 24-hour change delay; forwards claims to a cold wallet | Plain Solidity |
| `Heartbeat` | Base | Emits `Alive` when the user presses "I'm alive" | Plain Solidity |
| Mock USDC, mock vesting | Base Sepolia | Test tokens, and a vesting contract with the `VestingWallet` interface on a schedule we control | OpenZeppelin |

## Rule logic spec

Every decision lives in the user's `Rulebook` on Reactive; the executor and vault only carry out what it asks. That is the Integration story.

**Library rules.** Use `reactive-lib-omni` and the Omni callback format. Pre-Omni examples use a `vm` / ReactVM split that no longer exists. The cron mechanism is documented in the legacy section, so proving cron works on Lasna is part of the Day 1–2 test, along with confirming that a callback's ReactVM id is the wallet that deployed the rulebook.

**Subscriptions per user**

| Chain | Contract | Event and filter | Used for |
| --- | --- | --- | --- |
| Income chain | USDC token | `Transfer` with `to` = user's wallet | Rule 1: split |
| Each watched chain | Any token contract | `Transfer` with `from` = user's wallet | Guardian: activity |
| Each watched chain | Any token contract | `Approval` with `owner` = user's wallet | Guardian: activity |
| Destination chain | `Heartbeat` | `Alive` from the user (the "I'm alive" button) | Guardian: activity |
| Destination chain | `SavingsVault` | `Deposited` and `Withdrawn`, emitted only for the owner | Guardian: activity |
| Destination chain | `OrdersExecutor` | `Paused` and `Unpaused` for the user | Guardian: activity; stops callbacks while paused |
| Reactive | System contract | Cron event | Guardian clock, Rule 2 claim check, cap period reset |

Rule 2 has no event subscription: OpenZeppelin `VestingWallet` emits nothing when tokens vest, so the claim runs on cron.

Subscriptions must name a chain and an event; "all events on a chain" is not allowed. Filtering by event type plus the user's address as an indexed topic keeps each rulebook small.

**State in each Rulebook**

- Rule settings: income senders, split share, per-period cap, vesting contract, claim destination, silence period, grace period, Guardian check interval, claim interval. The beneficiary is stored in the vault on Base, not here.
- `lastActive[chain]` and `lastActiveAny`, the latest across chains.
- Guardian state: `Active`, `Warning` or `Released`, plus `warningSince`.
- `splitThisPeriod` to enforce the cap.

**What counts as activity.** Only actions the user signs: outgoing token transfers, approvals, the heartbeat, owner deposits and withdrawals on the vault, and pausing or unpausing. Two exclusions keep automation from fooling the Guardian:

- Ignore `Transfer` events whose `to` is the user's own vault. These are the executor's Rule 1 and Rule 2 moves. Claims bound for a cold wallet go to the vault first and are forwarded from there, so they are excluded too. Owner deposits are also transfers into the vault, so they count through the vault's own `Deposited` event instead.
- The `release()` step sends tokens from the vesting contract, not from the user, so it never counts.

Limit to state in the README: a plain ETH send emits no event, so it doesn't count. The heartbeat button covers this.

**Guardian states**

1. **Active.** On each cron tick, at most once per Guardian check interval by timestamp (1 hour on mainnet, 30 seconds in the demo): if `now − lastActiveAny` is past the silence period, move to Warning and emit `GuardianWarning`.
2. **Warning.** Any activity returns to Active and emits `GuardianCleared`. If the grace period passes with none, send a callback to the executor to release the vault to the beneficiary.
3. **Released.** Final. The rulebook unsubscribes and stops spending REACT.

**Protection against repeats and loops**

- Each callback carries a nonce; the executor rejects repeats.
- Most cron ticks return immediately after one timestamp check, to keep cost low.
- Executor and vault accept calls only from the Reactive callback proxy, and only when the callback's ReactVM id is the vault owner's wallet, which deployed the rulebook (`AbstractCallback`).

## Frontend: one page

One page handles setup, the Guardian and the three everyday actions. Everything else stays a Foundry script. The target is still a new user running in under 5 minutes, and the page is built Nov 26 to 30 while the mainnet vault runs.

**Design system.** The page follows the shared `DESIGN.md` used by Reflex, Steward and Helm. It uses app mode: pure black canvas, Inter at weight 400, Roboto Mono for every label and on-chain value, and hairline borders instead of shadows. Steward takes the warmer variant: more whitespace, plain-language sentences, fewer data rows.

**Rules that matter most here**

- Guardian states use color plus a word: Active is success green `(v) ACTIVE`, Warning is amber `[!] WARNING`, Released is Quartz `(v) RELEASED`.
- `[ I'M ALIVE ]` is the one Royal primary button on the page. Every other action is a bracket button.
- The vault balance is the one large stat (Inter 64, weight 400, tabular numbers). The logo gradient appears once, as a 1px top border on that card.
- Addresses are shortened the Reactscan way (`0x038E06...F9bD6B82`); amounts carry units in mono (`20.00 USDC`, `4.2 REACT`).
- Small red text uses `#FF5A6A`, never `#BC001D`. No emoji, no drop shadows.
- The product keeps its own name. A small "Built on Reactive" badge uses the official logotype from the press kit; the Reactive logo is never used as ours.

*Wireframe: see `Steward-PRD.pdf`, page 12 ("One page: vault and Guardian on top, rules below, scripts for the rest").* Top bar (Steward, Built on Reactive, `[ CONNECT WALLET ]`); `// VAULT BALANCE` card (0.00 USDC, saved automatically · days running) beside the `// GUARDIAN` card ((v) ACTIVE, 89d 04h until warning, last activity on Base, Arbitrum, `[ I'M ALIVE ]`); three rule cards (Pay yourself first / Claim and secure / Guardian, each with `[ ON ]`); `[ PAUSE ALL ]`, `[ WITHDRAW ]`, `// REACT BALANCE · [!] LOW REACT when low`; dashed `// RECENT ACTIONS` panel (P2, cut first). Editing rules, top-ups and beneficiary changes stay as scripts.

The dashboard reads top down: what you have, whether the Guardian is calm, then the rules and controls. With no vault, the same page shows the setup flow below instead.

**Page parts, top to bottom**

| Part | What it shows | Design notes | Priority |
| --- | --- | --- | --- |
| Top bar | Product name, network, `[ CONNECT WALLET ]`, "Built on Reactive" badge | Name in Inter 20; links in mono uppercase 14 | P0 |
| Vault card | Vault balance, total saved automatically, days running | Inter 64/400 stat; gradient top border, the only one on the page | P1 |
| Guardian card | State, countdown to warning or release, last activity per chain, `[ I'M ALIVE ]` | State colors as above; countdown in mono (`89d 04h until warning`) | P0 |
| Rule cards | Pay yourself first, Claim and secure, Guardian, each as one plain sentence with `[ ON ]` or `[ OFF ]` | Marketing-card style: 12px radius, 2px hairline, small ASCII icon | P0 |
| Controls | `[ PAUSE ALL ]`, `[ WITHDRAW ]`, rulebook REACT balance | Bracket buttons; pause asks to confirm; `[!] LOW REACT` banner in amber | P0 (REACT balance P1) |
| Recent actions | Each rule action with origin, Reactive and callback tx links | Reactscan list style: mono hash line, `4 minutes ago · (v) SUCCESS` | P2, cut first |

**Setup flow (same page, shown when the wallet has no vault)**

1. **Connect wallet** and pick testnet or mainnet.
2. **Choose rules.** The three rule cards turn into plain-language fields:
   - Pay yourself first: "Save __% of payments from these addresses."
   - Claim and secure: "Check this vesting contract every __ and claim into my vault / this cold wallet."
   - Guardian: "If I'm silent for __ days on these chains, warn me, wait __ days, then send my savings to this address."
3. **Review** a plain-English summary of every rule in a `// REVIEW` panel before anything is signed.
4. **Sign.** On Base: a USDC permit, a one-time vesting-token approval if Rule 2 is on, and one transaction that creates the vault. Then the wallet switches to Reactive for one transaction that deploys the rulebook with REACT attached. Each signature shows as a mono status row that moves from `(~) PENDING` to `(v) SUCCESS` with its tx hash.

**States.** Loading uses the ASCII spinner with a mono caption. With no vault, the empty state is an ASCII drawing, one sentence and `[ SET UP YOUR RULES ]`. A failed transaction shows `(x) FAILED` and one sentence on what to do next.

**Left as scripts.** Editing rules, topping up REACT, changing the beneficiary and the Guardian's "check now" call each have a Foundry script, documented in the README. Every page action also has a script, so the entry works without the page.

**Stack.** Next.js with wagmi, viem and RainbowKit; Tailwind with the theme extension from `DESIGN.md`; Inter and Roboto Mono through `next/font`. The page reads contract state and recent logs straight from RPCs, with no backend. The optional Telegram alert is a tiny listener script, cut first.

## Safety, security and non-functional requirements

These rules move a user's own money automatically, so safety is part of Usefulness, not an extra. A judge should finish the README confident that nothing can move funds the user didn't approve.

**Money safety**

- The executor can only pull up to the approved USDC cap, and Rule 1 enforces a per-period cap on top.
- Funds can only go to three places: the user's vault, the user's chosen cold wallet, or, after a full Guardian cycle, the named beneficiary. No other address is possible.
- The Guardian always warns first and waits a grace period. A release can never happen in a single step.
- One pause switch, held by the executor on Base, stops every rule at once. The owner can always withdraw from the vault, even when paused.
- Changing the beneficiary takes effect only after 24 hours (V-3), so a stolen key can't instantly redirect the vault.

**Contract security**

- Every callback receiver inherits `AbstractCallback` and accepts calls only from the Reactive callback proxy, and only when the callback's ReactVM id is the vault owner's wallet.
- Each callback carries a nonce; repeats are rejected.
- Run Slither before submission and note the results in the README.
- Never commit private keys; the repo ships `.env.example` only.

**Reliability and cost**

- Each rulebook needs REACT to pay for callbacks. Show its balance on the dashboard, warn when low, and handle debt with `coverDebt()`.
- Most cron ticks exit after one timestamp check to keep cost low.
- If cron misbehaves, the public "check now" function lets anyone advance the Guardian.

**Code and docs quality**

- Foundry, with a unit test per requirement ID and one end-to-end test per rule.
- One deploy script for the factory and shared contracts on each network, writing addresses to a JSON file.
- README order: what it is, video, tx-hash table, mainnet usage, architecture, safety limits, how to run.
- The repo is public and open-source by submission time, with an MIT license.

## Mainnet real-use plan

The track allows Reactive mainnet, and running our own vaults there for the last week is the strongest proof of "a tool you'd actually keep running." Most entries will be testnet-only.

**Setup**

- Reactive mainnet (chain ID 1597) for the rulebooks; Base mainnet (chain ID 8453) as the income and vault chain; Arbitrum (42161) as a second watched chain for the Guardian. All three are listed as supported mainnet chains in the Reactive docs.
- Base mainnet callback proxy: `0xCc780DdE33f56f55dE778D42c930959374a4a068`. Recheck on the Origins and Destinations page before deploying.
- Testnet and mainnet are separate setups: a testnet origin can only pair with a testnet destination.

**What I do (from Nov 26)**

- Set up a vault with small real amounts, for example 20 to 50 USDC of income routed through it.
- Turn on Rule 1 with a real income source (a friend or client paying me works), and Rule 2 if I have a real vesting contract.
- Turn on the Guardian with a real silence period (e.g. 90 days). It won't fire during the event; the point is to show it staying Active as my real activity resets it. The full warning and release cycle is shown on testnet with short times.

**What we collect for judges**

- A table of real mainnet tx hashes (origin, Reactive, callback) for every rule that fired.
- The number of days each vault ran and the total saved automatically.
- One or two sentences on what it did for me, plus one from any friend who ran a vault.

**Costs to plan for**

- Small amounts of real ETH on Base and Arbitrum for gas, and real REACT to fund each rulebook. How I get REACT on Reactive mainnet is an open question below.
- Keep amounts small: this is unaudited hackathon code.

## Risks and mitigations

The biggest risk is one person building the contracts, the frontend, the mainnet run and the video in 23 days, alongside Reflex. The plan puts a valid entry first (Rule 1 by Nov 19), makes every action work from a script before the UI, runs mainnet in the background, and cuts from a fixed list.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| One person, 23 days | Every part ends up half-finished | Rule 1 entry by Nov 19; scripts before UI; mainnet runs in the background; fixed cut order |
| Cron doesn't behave as documented on Omni | Guardian can't tell time | Test cron in the Day 1–2 loop; fallback to checking time on any incoming event plus the public "check now" function |
| Automatic moves reset the Guardian clock | Guardian never fires | Ignore transfers into the user's vault; claims don't come from the user; unit test for exactly this |
| A bug moves real money on mainnet | Loss of my funds | Small amounts only; caps; pause switch; owner can always withdraw |
| Getting REACT on mainnet is slow | No mainnet week | Sort it out in Week 1; if it fails, submit a testnet-only entry with a strong demo |
| Too many subscriptions per user raise cost | Rulebook runs out of REACT | Filter by the user's address in topics; watch at most two to three chains; low-REACT warning |
| Judges see three features, not one product | Lower Integration score | Tell one story: earn, save, protect, all around one vault |
| Similar entries in the track | Harder to stand out | Lead with the Guardian's cross-chain silence detection and the mainnet week |
| Standard vesting emits no unlock event | Rule 2 never fires on real contracts | Claim on a cron schedule; the executor calls `release()` and skips when nothing is releasable |
| Callbacks can't be tied to one user | One user's rulebook could move another user's funds | Each user deploys their own rulebook; the executor checks ReactVM id = vault owner; confirmed in the Nov 15 gate |

## Prerequisites before Day 1

Most of the setup is shared with Reflex (wallets, faucets, Foundry, RPC keys); see the Reflex PRD's Prerequisites. These are the extra items for Steward.

**Testnet**

- [ ] Lasna details: chain ID 5318007, RPC `https://lasna-rpc.rnk.dev/`, explorer lasna.reactscan.net.
- [ ] Callback proxies: Base Sepolia `0x476F44b11F5C942c58f4c8E3d0300E5710743585`, Unichain Sepolia `0x775c9B990ADe401060B78D0e98684eEf8d2466C1`.
- [ ] Test USDC on Base Sepolia, or our own mock USDC so we control amounts.
- [ ] lREACT for each test rulebook (Lasna faucet: send Sepolia ETH, 1 ETH to 100 lREACT).

**Mainnet (for the real-use week)**

- [ ] A way to get real REACT on Reactive mainnet for my rulebook (and a friend's, if one runs a vault).
- [ ] Small real balances: ETH for gas on Base and Arbitrum, and 20 to 50 USDC on Base for my vault.
- [ ] Base mainnet callback proxy `0xCc780DdE33f56f55dE778D42c930959374a4a068`, rechecked before deploying.

**Tools and reading**

- [ ] `reactive-lib-omni` (`forge install Reactive-Network/reactive-lib-omni`).
- [ ] Reactive's Cron Demo in reactive-smart-contract-demos, to copy the cron subscription pattern.
- [ ] OpenZeppelin `VestingWallet` as the real vesting pattern to support.
- [ ] A wallet-connect library for the setup form (e.g. RainbowKit or wagmi).

## Timeline, gates and owner

Steward is a one-person build. Rule 1 with the vault is a valid entry by Nov 19, my mainnet vault starts by script on Nov 26, the frontend is built while it runs, and I submit on Dec 4.

*Chart: see `Steward-PRD.pdf`, page 18.* Kickoff call Nov 12 · Hello loop + cron test Nov 13–15 · Rule 1 + vault Nov 16–19 · Reflex gate (other project) Nov 18 · Rule 2 + Guardian Nov 20–25 · Mainnet real-use week Nov 26–Dec 3 · Frontend (one page) Nov 26–30 · README + video Dec 1–4 · Submit on DoraHacks Dec 4 · Official deadline Dec 5.

Each phase ends with a gate. If a gate slips by more than two days, cut in this order: the Telegram alert, the dashboard's activity history, the second watched chain on mainnet (it stays in the testnet demo), then the mainnet week. The setup form and Guardian card are cut last; without them the entry falls back to scripts.

| Gate | Done when |
| --- | --- |
| Hello loop + cron test (Nov 15) | A test transfer on Base Sepolia triggers a callback through Lasna, the Rulebook receives cron ticks, and the callback's ReactVM id equals the wallet that deployed the Rulebook |
| Rule 1 + vault (Nov 19) | Income from a listed sender is split into the vault, with tx hashes. This alone is a valid entry |
| Rule 2 + Guardian (Nov 25) | A cron claim check releases vested tokens into the vault; the Guardian goes Active, Warning, Released with short demo timers |
| Mainnet vault live (Nov 26) | My vault runs on Base mainnet, set up by script, with Rule 1 and the Guardian on; the first real split has a tx hash |
| Frontend (Nov 30) | From the page I can set up a testnet vault end to end, press I'm alive, pause and withdraw, and watch the Guardian card count down for my mainnet vault |
| Mainnet week (Dec 3) | My vault has run for at least 7 days with real income and tx hashes; the Nov 26 start leaves one day of slack |
| README + video (Dec 4) | Every checklist item ticked |

**Owner:** the author, solo. Every action works from a Foundry script first and the page wraps those scripts, so a late frontend never blocks the mainnet run.

## Submission checklist and demo script

Submit by Dec 4, a day before the Dec 5, 21:00 WAT deadline, as a separate entry in the Set It and Forget It track.

**Required by the rules**

- [ ] Registered on DoraHacks with the Set It and Forget It track selected
- [ ] Public, open-source repository link
- [ ] Deployed contract addresses (testnet, and mainnet if used)
- [ ] Several tx hashes showing the full loop from origin event to callback, for each rule
- [ ] Demo video under 3 minutes
- [ ] All work built during the event

**Our own quality bar**

- [ ] Mainnet usage table: days running, total saved, tx hashes
- [ ] Safety limits section in the README
- [ ] Architecture diagram in the README
- [ ] Someone who didn't build it sets up a vault from the page alone (a friend, if one is available)

**Demo video script (under 3 minutes)**

1. **0:00–0:20. The problem.** Saving takes willpower, unlocks get forgotten, and crypto is lost when its owner disappears.
2. **0:20–0:40. Setup.** Fill in the form in plain language, then sign on Base and on Reactive.
3. **0:40–1:20. Earn and save.** A payment arrives and 20% lands in the vault; the claim check releases vested tokens into the vault. Explorer tabs show each callback.
4. **1:20–2:15. Protect.** With short demo timers: activity on a second chain resets the clock; then silence, a warning, and the release to the beneficiary.
5. **2:15–2:45. Real use.** My mainnet vault: days running, total saved, real tx hashes.
6. **2:45–3:00. Safety and repo.** Caps, pause, grace period, and the link.

## Open questions

Settle the first three at kickoff; the rest by the end of Week 1.

- [ ] Ask the organizers: can the same builder submit separate projects to two tracks?
- [ ] Ask the organizers: do mock vesting contracts count, as long as the reactive loop is real?
- [ ] How do we get real REACT on Reactive mainnet, and how much does each rulebook need for a week?
- [ ] Which income source feeds my mainnet vault, and can a friend run a second vault through the page?
- [ ] Which chains does the Guardian watch on mainnet: Base and Arbitrum, or Base and Unichain?
- [ ] Default numbers for the form: split share, per-period cap, silence and grace periods.

## Sources

- Reactive Omni Buildathon on DoraHacks: track brief, prizes, judging, rules
- Reactive docs: Origins and Destinations: supported chains and callback proxy addresses
- Reactive docs: Reactive Mainnet and Lasna Testnet: Lasna details and lREACT faucet
- Reactive docs: Reactive Library (Omni): `reactive-lib-omni`
- Reactive docs: Reactive Library (legacy): cron events from the system contract
- Reactive smart contract demos: Cron Demo
