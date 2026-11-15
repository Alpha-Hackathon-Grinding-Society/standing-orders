<p align="center"><img src="web/public/brand/steward-logo-horizontal-dark.svg" alt="Steward" width="360"></p>

# Steward

Set your money rules once: income gets split into savings, vested tokens get claimed into your vault, and if you go silent on every chain, your savings reach the person you chose. Every decision runs in your own reactive contract on [Reactive Network](https://reactive.network), with no bot, server or hot key.

> Work in progress for the Reactive Omni Buildathon (Set It and Forget It track). Progress per phase is in [docs/PROGRESS.md](docs/PROGRESS.md).

## What works today

| Rule | Status |
| --- | --- |
| **1. Pay yourself first**: a set share of USDC from your listed income senders moves into your vault, within a per-period cap | Live on Base Sepolia ↔ Lasna |
| 2. Claim and secure: vested tokens are claimed into your vault on a schedule | Phase 3 |
| 3. Guardian: after long silence, a warning, then a grace period, then your vault goes to your beneficiary | Phase 3 |

## On-chain evidence

Every rule action is three transactions: the event on Base (origin), your Rulebook reacting on Reactive, and the executor's callback on Base. All hashes, including Phase 1's loop and cron tests, are in [docs/TX_HASHES.md](docs/TX_HASHES.md).

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 1 split (listed sender, 20% of 100 USDC) | Base Sepolia → Lasna → Base Sepolia | [0x36a4…0095](https://sepolia.basescan.org/tx/0x36a4200afdf67756bb09d2f24dcfba16862ba0ad182acc5f7c851904dc460095) | [0xda7a…2dc5](https://lasna.reactscan.net/tx/0xda7a63891d09d89812ac5e164a0321437b54f8bcb8fec7fda8660bc2b25a2dc5) | [0x5dfc…53b0](https://sepolia.basescan.org/tx/0x5dfcca7df4f273fcbe0ced13abde6e527b59f9dc3128d37979d79be6e58c53b0) |
| Rule 1 ignored (unlisted sender) | Base Sepolia → Lasna | [0x0c02…9798](https://sepolia.basescan.org/tx/0x0c02b7c6415dd4ed7552102742b145401bb67d7eb3cfe49e60a561842d139798) | [0xce45…0c46](https://lasna.reactscan.net/tx/0xce4582125e24c26069381b96d52de0cab9bbd0b27727d9d7f0f84ef42c890c46) | none, by design |

## How it works

```
 Base Sepolia                      Lasna (Reactive)                  Base Sepolia
 ────────────                      ────────────────                  ────────────
 USDC Transfer ──event──▶  your Rulebook: listed sender?  ──callback──▶ OrdersExecutor
 (employer → you)          20% of it, within this period's cap        pulls 20 USDC from you
                                                                       into your SavingsVault
```

- **`Rulebook`** (Reactive, one per user, deployed from your wallet): holds your rules and decides every action.
- **`OrdersExecutor`** (Base, shared): accepts a callback only from the Reactive callback proxy, only from the Rulebook you registered, only with an unused nonce, and only while you're not paused. It can only move your USDC into your own vault, within the allowance you signed.
- **`SavingsVault`** (Base, one per user): you can deposit and withdraw any time, even while paused. A beneficiary change takes 24 hours.
- **`VaultFactory`** (Base): creates your vault at an address known in advance, applies your USDC permit and registers your Rulebook.

## How to run

```bash
git clone --recurse-submodules https://github.com/Alpha-Hackathon-Grinding-Society/standing-orders.git
cd standing-orders
make install   # pinned submodules (if you cloned without --recurse-submodules)
make test      # unit + fuzz tests
make help      # every build, deploy and e2e target
```

Requires [Foundry](https://getfoundry.sh) v1.9.0+ and Node.js (the e2e runners use it to read JSON). Copy `.env.example` to `.env` and fill in `PRIVATE_KEY` before any deploy.

**Rule 1 on testnet** (needs Base Sepolia ETH and lREACT on one wallet):

```bash
make deploy-base-sepolia   # VaultFactory + OrdersExecutor + Heartbeat + MockUSDC
make e2e-rule1             # employers, your Rulebook on Lasna, your vault, two payments; prints every tx hash
```

**Your own setup**, step by step: set `INCOME_SENDERS` and `BENEFICIARY` in `.env`, then `make deploy-rulebook-lasna` (Reactive first, so the vault can register your Rulebook) and `make create-vault-base-sepolia`.

## Docs

- [Product requirements](docs/PRD.md)
- [Design system](docs/DESIGN.md)
- [Reactive integration notes](docs/NOTES.md): exact APIs, live measurements, design decisions
- [Transaction hashes](docs/TX_HASHES.md)

## License

[MIT](LICENSE)
