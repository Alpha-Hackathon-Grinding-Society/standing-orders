# Security notes

Steward moves a user's own money without asking each time, so this file records what was checked, what each tool finding means, what the contracts trust, and the limits a user should know. The contracts are **not audited**; use small amounts.

## What is checked, and how

| Check | Result |
| --- | --- |
| Unit and fuzz tests (`forge test`) | 124 passed, 1 skipped (fork test, needs `BASE_RPC`). Every PRD requirement ID has a test named after it. |
| Invariant suite (`test/invariant/Steward.invariant.t.sol`) | 1,000 runs × depth 50 (50,000 random calls: deposits, withdrawals, pauses, payments from listed and unlisted senders, transfers on a second chain, cron ticks, time jumps, forged and replayed callbacks). All seven safety invariants hold. |
| Coverage of `src/` | 99.8% lines, 96.6% branches. `OrdersExecutor` and `SavingsVault`: 100% lines and 100% branches. |
| Slither 0.11.6 on `contracts/src` (solc 0.8.30) | 3 High, 9 Medium, 26 Low, 1 Informational, 6 Optimization. Every High and Medium finding is a false positive or intended, as explained below; two optimizations were applied. |
| Secrets in git history | None. The deployer key does not appear in any commit, and the RPC URLs in history are public endpoints with no API key. `.env` is git-ignored and never tracked; only `.env.example` ships. |

Run it yourself: `make test`, `make coverage`, `make slither` (needs `pip install slither-analyzer`).

## Slither triage

### High: `arbitrary-send-erc20` (3), intended

| Where | Why it's safe |
| --- | --- |
| `OrdersExecutor.split`: `safeTransferFrom(user, reg.vault, amount)` | `user` is a parameter, but the call only runs after `_authorize`: the sender must be the Reactive callback proxy, the injected first argument must be the Rulebook that `user` registered through the factory, and the nonce must be unused. The destination is always `user`'s own registered vault, and the amount is bounded by the permit the user signed (invariants 1, 3 and 4). |
| `OrdersExecutor.claim`: `safeTransferFrom(user, reg.vault, amount)` | Same authorisation. `amount` is exactly what the vesting wallet just released to `user` (and the wallet's `owner()` must be `user`), and the destination is `user`'s vault. |
| `SavingsVault.deposit`: `safeTransferFrom(owner, address(this), amount)` | `onlyOwner`: only the owner can pull their own tokens into their own vault. |

### Medium: `reentrancy-no-eth` (9), false positive

Every reported external call is to the Reactive **system contract** at `0x8888…8888` (`subscribe`, `unsubscribe`, `requestCallbackV_1_0`), a fixed protocol address that cannot be replaced and does not call back into the Rulebook. Seven of the nine are in the constructor's `_subscribeAll`, which runs before anyone else can call the contract. The other two (`react`, `_onCron`) only run when the system contract itself delivers an event, through `onlySystem`.

### Low (26), accepted

| Detector | Count | Note |
| --- | --- | --- |
| `timestamp` | 8 | Intended: every rule is a timer (the cap period, the claim interval, Guardian silence and grace, the 24-hour change delay). A validator's few seconds of drift are irrelevant at those scales. |
| `reentrancy-events` | 6 | Events emitted after calls to the system contract, the vault or the token. These are trusted contracts, and the order doesn't affect any state. |
| `missing-zero-check` | 6 | Five are in the Phase 1 probe contracts (`src/hello/`), which hold no funds. `SavingsVault.proposeColdWallet(address(0))` is allowed on purpose: it means "keep claims in the vault". |
| `calls-loop` | 3 | `Rulebook._release` unsubscribes in a loop (at most 2 + 2 × watched chains + 4 subscriptions), and `SavingsVault.release` reads the balance of each tracked token. Both loops are bounded by the user's own configuration. |
| `reentrancy-benign` | 3 | The same system-contract calls as above. |

### Informational and optimization

- `immutable-states` (5): **fixed.** `periodLength`, `claimInterval`, `silencePeriod`, `gracePeriod` and `guardianCheckInterval` are now `immutable`, so every cron tick reads them as constants instead of from storage.
- `cache-array-length` (1): `_setRules` loops over the old income senders once per `editRules` call. Not worth the extra line.
- `too-many-digits` (1): the CREATE2 address formula in `VaultFactory.predictVault` (`0xff` prefix), the standard form.

Forge's own linter also reports `unsafe-typecast` in `src/hello/HelloReactive.sol` (`address(uint160(topic))`). That's safe: indexed address topics are addresses padded to 32 bytes.

## What Steward trusts

- **Reactive Network.** The system contract delivers the right events and cron ticks, and the callback proxy on Base forwards only callbacks that a Reactive contract requested, with that contract's address injected as the first argument. The executor relies on this to know which Rulebook is calling (`docs/NOTES.md` §6).
- **The user's wallet.** Setup is signed from it. Steward never holds a key.
- **USDC and the user's vesting contract.** The user chooses the vesting contract, and the executor checks that it vests to the user before claiming.

## Known limits

- **The release callback has one shot.** When the Guardian releases, the Rulebook unsubscribes and stops. If the callback then fails on Base (for example, if the executor has run out of ETH for callback fees), nothing retries it. The savings stay in the vault, so the owner can still withdraw, but the beneficiary gets nothing until someone acts. Mitigation: keep the executor's ETH float funded. Check it with `cast balance <OrdersExecutor>`, and check the callback proxy's `debt(<OrdersExecutor>)` on Base. A beneficiary-triggered retry is a possible later addition.
- **No REACT, no rules.** If a Rulebook's REACT runs out, the network stops delivering its events, so every rule stops, the Guardian included. That fails safe: nothing moves, and the owner can still withdraw. The app warns at `[!] LOW REACT` and `OUT OF REACT`.
- **Paused forever means no release.** A due release waits while the user is paused, because pausing is the user's explicit choice.
- **Activity is only what emits an event.** A plain ETH send does not count. Use I'm alive.
- **Leftover REACT** after a release can be recovered by the owner with `withdrawReact` (`make withdraw-react`). It pays only the owner and never touches savings.
- **One vault per owner per factory**, at a CREATE2 address derived from the owner. A new factory deployment gives new addresses.
