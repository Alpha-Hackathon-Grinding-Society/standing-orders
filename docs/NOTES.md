# Reactive integration notes

This file holds the exact Reactive APIs Steward uses, with sources. When memory, older examples or this file disagree with the library source, the library source wins (CLAUDE.md).

**Sources read on 2026-11-13**

| Source | Version | Cited as |
| --- | --- | --- |
| `reactive-lib-omni` (installed at `contracts/lib/reactive-lib-omni`) | tag `v0.1.0`, commit `3ade0dc` | `lib:<file>:<line>` |
| Reactive docs source, `Reactive-Network/documentation` | commit `0ac3064` (2026-11-10) | `docs:<file>:<line>` |
| Legacy `Reactive-Network/reactive-lib` (comparison only) | commit `f6990ce` | `legacy:<file>:<line>` |
| `Reactive-Network/reactive-smart-contract-demos` (Cron Demo) | commit `6fd02ce` (2026-10-07) | `demos:<file>` |

`lib:` paths are relative to `contracts/lib/reactive-lib-omni/`. `docs:` paths are relative to `docs/docs/` in the documentation repo (published at dev.reactive.network).

---

## 1. Base contracts and toolchain

| Name | Where | Role |
| --- | --- | --- |
| `AbstractReactive` | `lib:src/base/AbstractReactive.sol:12` | Base for reactive contracts (our `Rulebook`). Supplies `SYSTEM`, `REACTIVE_IGNORE`, `onlySystem`. |
| `AbstractCallback` | `lib:src/base/AbstractCallback.sol:11` | Base for callback receivers (our `OrdersExecutor`). Constructor `(IPayable callbackProxy_, address callbackSender_)`. |
| `AbstractPayer` | `lib:src/base/AbstractPayer.sol:11` | Shared by both: `pay()`, `_coverDebt()`, `onlyServiceProvider`, payable `receive()`. |
| `IReactive.LogRecord` | `lib:src/interfaces/IReactive.sol:13-26` | The struct `react()` receives. |
| `ISystemContract` | `lib:src/interfaces/ISystemContract.sol:11-31` | `subscribe`, `unsubscribe`, `requestCallbackV_1_0`, `debt`. |

- **Pragma.** Every library file is `pragma solidity ^0.8.29` (e.g. `lib:src/base/AbstractReactive.sol:3`). CLAUDE.md says `^0.8.20`; our contracts use `^0.8.29` and `foundry.toml` pins **solc 0.8.30** so the library compiles.
- **EVM version.** `foundry.toml` sets `cancun`. Base, Arbitrum and Unichain support it; Lasna's EVM version is not documented. **Confirmed in Phase 1:** `cancun` bytecode deploys and runs on Lasna (§11).
- **Import prefix.** The docs import as `@reactive/src/...` (`docs:reactive-contracts.mdx:29-31`). `contracts/remappings.txt` maps `@reactive/` to `lib/reactive-lib-omni/`.
- **A contract cannot be both reactive and callback**: the two bases set the same immutable `_SERVICE_PROVIDER` to different things and won't compile together (`docs:callback-contracts.mdx:57`).
- **Library license.** Library files are `SPDX-License-Identifier: UNLICENSED`. Steward's own code is MIT; the library stays an unmodified submodule. Noted in case judges ask.

## 2. The vm / ReactVM split is gone in Omni

- Omni `AbstractReactive` has no `vm` flag, no `detectVm()`, no `rnOnly` / `vmOnly` (`lib:src/base/AbstractReactive.sol:12-27`). The legacy version had all of them (`legacy:src/abstract-base/AbstractReactive.sol:14-41`).
- There is one contract instance. `react()` is an ordinary transaction from the system contract and "can do anything an ordinary function can, including subscribing, unsubscribing, and requesting callbacks" (`docs:reactive-contracts.mdx:242`).
- Subscriptions can be changed at any time, including from owner-only functions and inside `react()` (`docs:reactive-contracts.mdx:119-160`).
- **Consequence for Steward:** `editRules` (owner-only) and `checkNow` (public) are plain external functions on the `Rulebook`, and they share state with `react()`. The caller pays Reactive gas as for any transaction. A callback requested from them is billed to the recipient as usual (`docs:reactive-contracts.mdx:289`). This answers the "Direct calls to a reactive contract" fact on paper; Phase 3 confirms it live.

## 3. Subscribing

- **System contract:** `SYSTEM = 0x8888888888888888888888888888888888888888` (`lib:src/base/AbstractReactive.sol:14`). It is the same address on mainnet and Lasna (docs Origins & Destinations tables).
- **Call:** `SYSTEM.subscribe(uint256 chainId_, address contract_, uint256 topic0_, uint256 topic1_, uint256 topic2_, uint256 topic3_)` and the matching `unsubscribe` (`lib:src/interfaces/ISubscriptionService.sol:17-40`). Usually called in the constructor (`docs:reactive-contracts.mdx:44-51`).
- **Wildcards** (`lib:src/interfaces/ISubscriptionService.sol:11-16`, `docs` WildcardTable):

  | Criterion | Wildcard | Matches |
  | --- | --- | --- |
  | `chainId_` | `0` | Any chain |
  | `contract_` | `address(0)` | Any contract on the specified chain |
  | `topic0_`..`topic3_` | `REACTIVE_IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad` (`lib:src/base/AbstractReactive.sol:17`) | Any value |

- **Rules** (`docs:reactive-contracts.mdx:105-121`):
  - At least one criterion must be specific; "everything everywhere" is rejected.
  - Matching is equality only, with one criteria set per subscription. For OR, call `subscribe` once per combination. Steward's income-sender list is therefore filtered inside `react()`, not in the subscription.
  - Subscriptions live in the node, not in storage, so the contract can't read its own back. The Rulebook must keep its own record to unsubscribe exactly on release. `unsubscribe` needs all six arguments to match exactly, or it fails silently.
- **Contract wildcard (CLAUDE.md fact):** "one event type across a chain" (specific chain, `address(0)`, specific topic0) is a documented shape (docs SubscriptionTable). Steward's activity subscriptions are `subscribe(chainId, address(0), Transfer, user, REACTIVE_IGNORE, REACTIVE_IGNORE)` for outgoing transfers and the same with `Approval` and `owner = user`. **Allowed per docs; Phase 1 confirms it live.**
- **Debt blocks delivery:** a contract with any debt receives no events (`docs:economy.mdx:27-29`).

## 4. Receiving events: `react()`

- Signature: `function react(LogRecord calldata log_) external` (`lib:src/interfaces/IReactive.sol:45`). Guard it with `onlySystem` (`lib:src/base/AbstractReactive.sol:23-26`), which checks `msg.sender == SYSTEM` via `_onlyServiceProvider` (`lib:src/base/AbstractPayer.sol:44-48`).
- `LogRecord` fields (`lib:src/interfaces/IReactive.sol:13-26`): `chainId, contractAddress, topic0, topic1, topic2, topic3, data, blockNumber, opCode, blockHash, txHash, logIndex`. Field names are `topic0` (not legacy `topic_0`). `opCode` is the number of topics (a LOG3 has `opCode == 3`), and is the reliable way to tell a missing topic from a zero one (`docs:reactive-contracts.mdx:219-240`).
- **No timestamp in the record.** As CLAUDE.md assumed, the Guardian records activity with the Reactive block's `block.timestamp` when `react()` runs, not the origin block's time. Activity is therefore timestamped a few seconds late; this is negligible against 90-day or 3-minute windows.
- **Don't revert to filter.** A revert is caught, logged as `ReactiveContractReverted`, and still billed. Non-matching logs must simply fall through (`docs:reactive-contracts.mdx:238`).
- **Gas cap:** 900,000 per reactive transaction (`docs:economy.mdx:94-96`).

## 5. Requesting callbacks

- **Call:** `SYSTEM.requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0({chainId, recipient, gasLimit, payload}))` (`lib:src/interfaces/ISystemContract.sol:16-30`, `docs:reactive-contracts.mdx:246-287`). The `Callback` event still works but is deprecated (`lib:src/interfaces/IReactive.sol:28-40`).
- The system contract emits `CallbackRequest(chainId indexed, sender indexed, recipient indexed, version, configuration)`. Explorers and our e2e scripts can filter on it to find the Reactive tx (`docs:reactive-contracts.mdx:299-309`).
- **Payload first argument:** the network overwrites the first 160 bits of the payload with **the address of the reactive contract that requested the callback**. The payload must declare an `address` first and pass `address(0)` (`docs:reactive-contracts.mdx:266-268`; `lib:src/interfaces/IReactive.sol:34`).
- **Gas:** minimum callback gas limit is 100,000; smaller requests are ignored (`docs:economy.mdx:98-100`). The proxy withholds `_extraGas` and `_maxChargeGas` before forwarding. Too little left fails with `InsufficientGas`; a revert inside the method surfaces as `CallbackFailure` (`docs:callback-contracts.mdx:87`).
- **The gas limit is the whole destination tx's limit** (measured in Phase 1, §11). The proxy keeps `_extraGas + _maxChargeGas + failure-event gas` (≈ 135k on Base Sepolia) before calling the recipient, and calldata takes ≈ 25k more. **Budget = method gas + 160k.** Fees are charged on gas used, so a generous limit costs nothing extra.
- **Lookup:** `SYSTEM.getCallbacks(uint256 reactiveTxHash)` is documented to return the destination tx hash for each callback a reactive tx posted (`docs:economy.mdx:264-272`). **On Lasna in Phase 1 it returned `[]` even for delivered callbacks**, so the e2e scripts instead find the callback through the recipient's own event on the destination chain.

## 6. Authenticating callbacks: no "ReactVM id" in Omni

- `AbstractCallback(callbackProxy_, callbackSender_)` stores `_CALLBACK_SENDER` **immutably** (`lib:src/base/AbstractCallback.sol:18-24`). `callbackSender_` is "the reactive contract allowed to send callbacks", meaning a contract address.
- Two guards, and the docs say to always use both (`docs:callback-contracts.mdx:61-69`):
  - `onlyServiceProvider`: `msg.sender == callback proxy` (`lib:src/base/AbstractPayer.sol:38-48`).
  - `onlyCallbackSender(firstArg)`: the injected first argument equals `_CALLBACK_SENDER` (`lib:src/base/AbstractCallback.sol:28-39`).
- Legacy behaviour was different: `rvm_id = msg.sender` (the callback contract's deployer) and `rvmIdOnly` compared the injected arg against it (`legacy:src/abstract-base/AbstractCallback.sol:52-63`). The PRD's "ReactVM id = deployer wallet" comes from that model.
- **Finding: the CLAUDE.md fact "Callback ReactVM id equals the wallet that deployed the reactive contract" does not hold in Omni.** The injected value is the Rulebook's own address, and the docs state this explicitly. See **Design impact A** below. Phase 1 will still measure it live as the gate requires.

## 7. Cron

- Cron events come from the **legacy** system contract `0x0000000000000000000000000000000000fffFfF`, which validators call at fixed block intervals. Subscribe with that address as `contract_` and the Reactive chain's own id: `SYSTEM.subscribe(block.chainid, 0x…fffFfF, CRON_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE)` (`docs:reactive-contracts.mdx:162-186`).
- Each event is `CronN(uint256 number)`, with the non-indexed block number in `data` (`docs:reactive-contracts.mdx:190`). Topics are verified with `cast keccak` and in `contracts/test/unit/ReactiveConstants.t.sol`; constants live in `contracts/src/libraries/ReactiveConstants.sol`.

  | Event | Every | topic0 | Docs (2026-11-10) | Cron Demo README (2026-10-07) |
  | --- | --- | --- | --- | --- |
  | `Cron1` | 1 block | `0xf02d6ea5c22a71cffe930a4523fcb4f129be6c804db50e4202fb4e0b07ccb514` | ~1 s | ~7 s |
  | `Cron10` | 10 blocks | `0x04463f7c1651e6b9774d7f85c85bb94654e3c46ca79b0c16fb16d4183307b687` | ~10 s | ~1 min |
  | `Cron100` | 100 blocks | `0xb49937fb8970e19fd46d48f7e3fb00d659deac0347f79cd7cb542f0fc1503c70` | ~2 min | ~12 min |
  | `Cron1000` | 1,000 blocks | `0xe20b31294d84c3661ddc8f423abb9c70310d0cf172aa2714ead78029b325e3f4` | ~17 min | ~2 h |
  | `Cron10000` | 10,000 blocks | `0xd214e1d84db704ed42d37f538ea9bf71e44ba28bc1cc088b2f5deca654677a56` | ~3 h | ~28 h |

- **The two sources disagree on block time (~1 s vs ~7 s).** **Phase 1 measured Lasna: 1.07 s per block** (1,000 blocks in 1,072 s), and **`Cron10` ticked every 10.6 s on average over 68 ticks** (§11). The docs column is right for Lasna.
- **Every tick is billed**, whether `react()` does anything or not, and overlapping subscriptions (e.g. Cron1 + Cron10) are billed separately (`docs:reactive-contracts.mdx:192-194`). The Rulebook subscribes to **one** cron topic, chosen per network, and does all time-based work (Guardian check, claim check, cap reset) on that tick behind timestamp comparisons.
- **Proposed defaults, to confirm with Phase 1 measurements:** demo/testnet `Cron10` (fine enough for a 30-second Guardian check if blocks are ~1 s); mainnet `Cron1000` (one tick per ~17 min to ~2 h, either way within a 1-hour check interval's tolerance and cheap over a week).

## 8. Paying: REACT on Reactive, ETH on Base

- **Fee formula** for both sides: `fee = max(tx.gasprice, basefee) × (coeffPer1000 / 1000) × (gasUsed + extraGas)`. Defaults on Reactive are coeff 1000, `extraGas` 100,000, `maxChargeGas` 50,000; proxies have per-chain values. Read the live values with `_gasPriceCoeffPer1000()`, `_extraGas()`, `_maxChargeGas()` (`docs:economy.mdx:41-86`).
- **Reactive side (Rulebook, REACT/lREACT).**
  - Charged after each `react()`. Reserves pay first, then the system contract calls `pay(amount)` on the contract (`lib:src/base/AbstractPayer.sol:51-53`), which sends from its own balance (`docs:economy.mdx:136`).
  - **Funding routes** (`docs:economy.mdx:106-161`): a payable constructor (`--value` on deploy); a direct transfer to the contract plus `coverDebt()`; or `SYSTEM.depositTo(address)`, which needs no cooperation from the contract. Sending REACT straight to the system contract credits the *sender*, not the contract.
  - **`coverDebt`:** `_coverDebt()` is internal (`lib:src/base/AbstractPayer.sol:55-59`): it reads `_SERVICE_PROVIDER.debt(address(this))` and pays it. The Rulebook will expose `function coverDebt() external { _coverDebt(); }`, left public so anyone can revive a user's Rulebook (`docs:reactive-contracts.mdx:313-326`).
  - Status: any debt > 0 blacklists the contract (`BlacklistContract`) until a deposit clears it (`WhitelistContract`) (`docs:economy.mdx:163-170`). Reads: `debt(address)`, `reserves(address)` on `SYSTEM`; `cast balance` for the contract.
- **Destination side (OrdersExecutor, ETH on Base).**
  - **Callbacks are billed to the recipient, in the destination chain's native token, never REACT** (`docs:callback-contracts.mdx:77-81`, `docs:reactive-contracts.mdx:291`).
  - **A failed or rejected callback is still charged** (`docs:economy.mdx:88-90`). A recipient in debt gets nothing (`InDebt`).
  - Fund the executor with `proxy.depositTo(executor)` or a transfer plus a `coverDebt()` wrapper (`docs:economy.mdx:172-194`). See **Design impact B**.

## 9. Addresses (rechecked 2026-11-13 against docs commit `0ac3064`)

| Network | Chain ID | Callback proxy | RPC | Explorer |
| --- | --- | --- | --- | --- |
| Reactive mainnet | 1597 | system `0x8888888888888888888888888888888888888888` | https://mainnet-rpc.rnk.dev/ | https://reactscan.net |
| Lasna testnet | 5318007 | system `0x8888888888888888888888888888888888888888` | https://lasna-rpc.rnk.dev/ | https://lasna.reactscan.net |
| Base | 8453 | `0xCc780DdE33f56f55dE778D42c930959374a4a068` ✔ matches PRD | | basescan.org |
| Arbitrum | 42161 | `0xaee8d2deBaB5bE353bfec167C58a549923892e11` (new; not in PRD) | | arbiscan.io |
| Base Sepolia | 84532 | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` ✔ matches PRD | | sepolia.basescan.org |
| Unichain Sepolia | 1301 | `0x775c9B990ADe401060B78D0e98684eEf8d2466C1` ✔ matches PRD | | sepolia.uniscan.xyz |

- **lREACT faucet** (`docs:reactive-mainnet.mdx:39-83`): send Sepolia ETH to `request(address)` on Base Sepolia `0x2afaFD298b23b62760711756088F75B7409f5967` or Ethereum Sepolia `0x9b9BB25f1A81078C544C829c5EB7822d747Cf434`. The rate is 1 ETH → 100 lREACT, max 5 ETH per send (anything above is lost).
- **Mainnet REACT** (PRD open question): official WREACT↔REACT bridges exist. On Base, `0xe68eAD313A33A78E0B00e25aE22800D4455cd5C8`; on Reactive, `0xCAe30c6Ca71E830bE6370d110758e76fB9e44D9B` for REACT↔WREACT to Base (`docs:official-addresses.md:15-18`). The route is to buy WREACT on Base and bridge it to Reactive. Phase 4 confirms amounts.

## 10. Testing helpers

- `Reactive-Network/reactive-test-lib` (commit `2ff9b2a`, 2026-03-16) targets the **legacy** library: it etches its mock at `0x…fffFfF` and models an `rvmId`. It doesn't match Omni (`SYSTEM` at `0x8888…`, injected sender = contract address), so we **don't install it**. Phase 1 adds two small mocks of our own under `contracts/test/`:
  - a `MockSystem`, `vm.etch`ed to `0x8888…`, that records `subscribe` / `requestCallbackV_1_0` calls;
  - a `MockCallbackProxy` that calls the executor with the requesting contract's address injected as the first argument.

## 11. Phase 1 live measurements (2026-11-15, Base Sepolia ↔ Lasna)

Contracts: `src/hello/HelloReactive.sol`, `src/hello/HelloReceiver.sol`, `src/hello/WildcardProbe.sol`. Hashes: `docs/TX_HASHES.md`.

| Question | Answer | Evidence |
| --- | --- | --- |
| Injected callback sender ("ReactVM id") | **The reactive contract's own address**, not the deployer wallet. Run 1 payload carried `0x4461…9686` (HelloReactive); run 2 stored `lastRvmId = 0xB49e…82BA` (HelloReactive). | `CallbackFailure` data in `0x965a…1c89`; `HelloReceiver.lastRvmId()` |
| Who calls the recipient | The callback proxy `0x476F…3585` (`msg.sender`). The tx is sent by a relayer EOA (`0xF7E8…1DDb`) to the proxy. | callback tx `0x57e0…a1f6` |
| Origin → callback latency | **≈ 1 s**: callback 6 Base Sepolia blocks after the origin tx (blocks are ~0.2 s now). Run 1: 9 blocks. Lasna block timestamps ran ~1 s behind Base's, so per-hop splits are below clock resolution. | block numbers 59256158 → 59256164 |
| Lasna block time | 1.07 s | 1,000 blocks in 1,072 s |
| `Cron10` interval | **10.6 s mean** (10 or 11 s), 68 ticks | `TX_HASHES.md` cron table |
| lREACT per cron tick (tiny handler, ~22k execution gas) | **0.0121971** (first tick 0.0156, cold storage) | balance drop across each tick block |
| lREACT per ignored event (react returns early) | ≈ 0.0110 | HelloReactive run 2, mint reaction |
| lREACT per event + callback request | 0.0147532 | balance across Lasna block 8433971 |
| ETH per callback on Base Sepolia (161k gas tx) | 0.0000011546 ETH | HelloReceiver balance across block 59256164 |
| Reactive tx gas price | **0**: reactive txs come from the system contract with `effectiveGasPrice = 0`; the network debits the contract's balance in the same block. Measure cost from balance changes, not receipts. | any tick receipt |
| Charge formula check | Charge ≈ 100 gwei × (execution gas + 100k `_extraGas`). Cron tick: 21,971 + 100,000 = 121,971 gas → 0.0121971 lREACT. | |
| Contract wildcard + user topic | **Works.** `subscribe(84532, address(0), Transfer, user, *, *)` and the same with `Approval` matched an unnamed token's `approve` and `transfer`; the `from = 0` mint didn't match. | `WildcardProbe`, two Reactive txs |
| Unsubscribe from an owner call | Works. `stopCron()` (a direct owner tx to the reactive contract) ended the cron subscription; two in-flight ticks still arrived. | `0x6777…2a79` |
| Callback gas | 200k was too little: the proxy left `ping` ~40k and it ran out of gas, but **the recipient was still charged**. 500k works (161k used in total). | run 1 vs run 2 |
| `forge script` on Lasna | Works; local simulation of `SYSTEM.subscribe` succeeds, so deploy scripts don't need `forge create`. | deploy txs |
| Faucet rate | 0.044 Sepolia ETH → 4.62 lREACT (105 per ETH, not 100) | 2026-11-15 |

**Cost consequences (feeds Design impact C).** At ≈ 0.0122 lREACT per minimal tick, a cron costs `0.0122 × 86,400 / interval` per day:

| Cron | Lasna interval | Ticks/day | lREACT/day (minimal handler) |
| --- | --- | --- | --- |
| `Cron10` | 10.6 s | 8,150 | ≈ 100 |
| `Cron100` | ~107 s | 810 | ≈ 10 |
| `Cron1000` | ~18 min | 81 | ≈ 1 |
| `Cron10000` | ~3 h | 8 | ≈ 0.1 |

A Rulebook tick that exits after one timestamp comparison will cost about the same as HelloReactive's. Mainnet REACT gas price may differ; Phase 4 rechecks.

## 12. Phase 2 live measurements and decisions (2026-11-15)

| Item | Value |
| --- | --- |
| Rule 1 origin → callback | 8 Base Sepolia blocks (~2 s) |
| lREACT per income event that triggers a split (`react` + callback request) | 0.0181995 |
| lREACT per ignored income event (unlisted sender) | 0.0114804 |
| ETH per split callback on Base Sepolia | 0.0000010312 (143k gas tx; 400k limit) |
| Real Base USDC (fork test) | Accepts our permit; `transferFrom` emits `Transfer(user → vault)` and **no** `Approval`, so the executor's pull never looks like user activity (safety invariant 6) |

**Decisions made in code (all follow approved Design impact A/B/C):**
- `VaultFactory.createVault(config, permit)`: `config` = `{token, rulebook, beneficiary}`. `rulebook` is new versus CLAUDE.md task 2, per Design A. The executor stores `{vault, token, rulebook}`; there's no separate `incomeChain` field, because Rule 1's income token, the executor and the vault all live on the same chain (Base).
- The factory deploys `OrdersExecutor` in its constructor, so the executor trusts exactly one factory and neither has an admin key.
- `AbstractCallback` is constructed with `callbackSender_ = address(0)`, and `onlyCallbackSender` is never used. The executor checks `injectedSender == rulebookOf(user)`.
- The initial beneficiary is set once by the factory at creation, with no delay. Later changes wait 24 hours.
- The cap period rolls over on cron **and** lazily before any split, so a late cron never blocks or over-allows a split.
- The cron topic is a Rulebook constructor setting (approved default C): `Cron100` on Lasna, `Cron1000` on mainnet.
- **The permit is a lifetime budget**, not per period: the executor's allowance shrinks with every split. When it runs out, splits fail on Base (and are still charged) until the user signs a new permit or approval. Phase 5's dashboard should show the remaining allowance.

## 13. Phase 3 live findings (2026-11-16)

| Item | Finding | Evidence |
| --- | --- | --- |
| Unichain Sepolia as an origin | Works: a user transfer there reached the Lasna Rulebook and cleared a Warning (contract wildcard + `from = user`). Listed as origin and destination in the Omni testnet table (`docs` `origins-destinations-testnet-omni.js`). | Run B, `0xf73c…076f` → `0xe86e…9642` |
| Unsubscribe on release | Stops all spending: the released Rulebook's lREACT balance stayed flat afterwards (runs A and B). Unsubscribing from inside `react()` works. | `Rulebook.state() == 2`, balance unchanged |
| Demo cost | A full demo run (Cron10, ~10 min, 4+ claims, 2 warnings, 1 clear, 1 release) cost 0.81 lREACT. | Run B |
| Claims vs the one-time approval | A claim before the user's VEST approval fails on Base and is still charged. The release step in the same callback is rolled back with it, so nothing is left half-done. The setup now approves **before** deploying the Rulebook. | Run A |
| `VestingWallet.release(token)` | Public; the executor calls it and the tokens go to the vesting owner (the user), then into the vault. No event as tokens vest, so cron is required (C-3). | Run B claim |
| Leftover REACT after release | A Released Rulebook keeps its remaining REACT and has no way to send it back: 1.99 lREACT (run A) and 0.69 (run B) are stranded. See open question in PROGRESS. | `cast balance` |
| Direct owner call to a reactive contract | Works and is paid by the caller like any tx (Phase 1 `stopCron`, Phase 3 deploy-time calls). `checkNow` is the same kind of call. | `0x6777…2a79` |
| Timestamps | Activity is timed with Lasna's `block.timestamp`: the Run A warning fired 186 s after the last activity (silence 180 s + check/cron granularity). | Run A |

---

## Design impact (A and B approved 2026-11-15; C approved with the Phase 1 cron default)

**A. Callback authentication: "ReactVM id = vault owner" becomes "callback sender = the owner's registered Rulebook."**
In Omni, the executor sees the *Rulebook's address*, not the user's wallet (§6). `AbstractCallback`'s single immutable `_CALLBACK_SENDER` also can't serve one shared executor with a Rulebook per user.

*Proposed default:*
- `OrdersExecutor` inherits `AbstractCallback`, using the proxy for payment and `onlyServiceProvider` for the `msg.sender` check.
- Instead of `onlyCallbackSender`, it checks `injectedSender == rulebookOf[user]`.
- `rulebookOf[user]` is written only in a call made by `user` (inside `VaultFactory.createVault`).
- Safety invariant 4 becomes: *only from the callback proxy, only when the injected sender is the Rulebook the vault owner registered, never with a repeated nonce.*

*Knock-on: setup order.* The Rulebook must exist before `createVault` can register it, so setup becomes **Reactive first, then Base**:
1. The page reads `factory.predictVault(user)`, a CREATE2 address with salt = owner that is already planned.
2. The user deploys the Rulebook on Reactive with REACT attached, passing the predicted vault and the executor.
3. The user signs the USDC permit and calls `createVault(config, permit, rulebook)` on Base.

This is still one tx per chain plus one signature, as the PRD's U-1 requires; only the order flips. F-1's "deploy from the user's own wallet" still holds: it makes the user the Rulebook owner and REACT payer, just no longer the callback identity.

**B. The executor pays every callback in ETH on Base.**
Callbacks are billed to the recipient (§8), and a rejected callback is still charged. A shared executor therefore pays for every user's splits, claims and releases. It can also be griefed: any reactive contract can request callbacks to it, at the attacker's REACT cost plus our ETH.

*Proposed default for the hackathon:* keep one shared executor, funded by us with a small ETH float via `proxy.depositTo`. Expose a public `coverDebt()`. Show the executor's ETH balance next to the REACT balance, and document the griefing limit in SECURITY.md. Amounts are tiny on Base (≈ a few cents per callback at current gas), and Phase 1 measures the real per-callback charge. The alternative is a callback receiver per user, funded by that user. That is a bigger change, so I'd only consider it if Phase 1 shows the cost is material.

**C. Cron choice and cost.** One cron subscription per Rulebook, billed every tick (§7). Phase 1 measured ≈ 100 lREACT/day for `Cron10` and ≈ 1 for `Cron1000` (§11).

*Proposed default (updated after Phase 1):* the cron topic becomes a Rulebook constructor setting.
- **Mainnet: `Cron1000`** (~18 min). That's within a 1-hour Guardian check interval, at about 1 REACT/day (≈ 7 REACT for the 7-day usage window, before any price check).
- **Testnet demo Rulebooks: `Cron10`**, deployed shortly before a demo run and retired afterwards (owner `editRules` or an unsubscribe op), because they burn ≈ 4 lREACT an hour.
- **Long-running testnet Rulebooks: `Cron100`** (≈ 10 lREACT/day).

**Decisions recorded 2026-11-15:** the user approved **A** and **B** as proposed above.

---

## Status of CLAUDE.md "Facts to verify"

| Fact | Status after Phase 1 | Source |
| --- | --- | --- |
| Lasna: 5318007, `https://lasna-rpc.rnk.dev/`, lasna.reactscan.net, faucet 1 ETH → 100 lREACT | ✔ confirmed live; the faucet paid 105 lREACT per ETH on 2026-11-15 (5 ETH cap per docs) | §9, §11 |
| Testnet callback proxies (Base Sepolia, Unichain Sepolia) | ✔ Base Sepolia proxy `0x476F…3585` delivered callbacks live (bytecode present, rechecked 2026-11-15). Unichain Sepolia: docs only; Phase 3 uses it | §9, §11 |
| Base mainnet proxy `0xCc78…a068` | ✔ confirmed in docs; recheck in Phase 4 | §9 |
| Mainnet chains Reactive 1597, Base 8453, Arbitrum 42161 supported | ✔ all listed as origin and destination | §9 |
| Callback ReactVM id = deployer | ✘ **confirmed false live**: the injected address is the reactive contract itself. Handled by approved Design impact A | §6, §11 |
| Cron topics, intervals, cost | ✔ `Cron10` = 10.6 s on Lasna; 0.0122 lREACT per minimal tick (≈ 100 lREACT/day for `Cron10`) | §7, §11 |
| Contract wildcard (`address(0)`) with user as indexed topic | ✔ confirmed live for `Transfer` and `Approval` | §3, §11 |
| Direct calls to a reactive contract (`checkNow`, `editRules`) | ✔ ordinary txs paid by the caller, sharing state with `react()` (live: `stopCron` in Phase 1; `checkNow` unit-tested) | §2, §13 |
| REACT funding and `coverDebt` | ✔ mechanics documented; REACT per day measured in Phases 3–4 | §8 |
| OZ `VestingWallet.release(token)` permissionless, no vesting event | ✔ `release(address)` is `public` (`openzeppelin-contracts/contracts/finance/VestingWallet.sol:126`); called live by the executor in Phase 3 | §13 |

**Also checked:** OpenZeppelin v5.7 `ERC20.transferFrom` spends allowance with `emitEvent = false`, so it emits **no** `Approval` (`openzeppelin-contracts/contracts/token/ERC20/ERC20.sol:259`). Executor pulls therefore don't look like user activity on our mocks. Real Base USDC still needs a Phase 2 fork test.
