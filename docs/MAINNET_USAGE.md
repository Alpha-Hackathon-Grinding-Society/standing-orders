# Mainnet usage

Steward's real vault on Base mainnet, owned by the builder's own wallet `0x810fCBF8A695Ffa0e4480207c667995139F33276`, running from **2026-11-26**. Every row is a real action with its hashes. Explorers: Base https://basescan.org/tx/ · Reactive https://reactscan.net/tx/

- Vault `0xD5f071D9e4E32a2f4004742AFFD77C127f14Dc75` (Base) · Rulebook `0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a` (Reactive mainnet)
- Rules: 20% of USDC from `0x69Df…32c9`, at most 5 USDC per 30 days; Guardian 90 d / 14 d, hourly, Base + Arbitrum; `Cron1000`
- Small, unaudited amounts only: permit budget 5 USDC.

## Rule actions

| Date (UTC) | Rule | Origin (Base) | Reactive | Callback (Base) | Amount saved |
| --- | --- | --- | --- | --- | --- |
| 2026-11-26 02:15 | Pay yourself first | [0xe98c0af1…cd86](https://basescan.org/tx/0xe98c0af12daabde1f1bc4908d79e452e4ef9d81e2e124adf654034a6d70ccd86) | [0xf32c83d3…8b81](https://reactscan.net/tx/0xf32c83d342bdd748710f03576c23986b8d4dd9bd521729e1e19074b022558b81) | [0x95f8b3c1…3eb0](https://basescan.org/tx/0x95f8b3c1e0d4498a2e86b215612d4f69790cd9ce27d7392237e67a96eb383eb0) | 0.20 USDC |

## REACT spent

Rulebook funded with 30 REACT at 01:58 UTC on 2026-11-26 (deploy fee paid separately by the wallet). Read the balance with `make status NET=reactive`.

| Date (UTC) | Rulebook REACT | Spent since previous | Note |
| --- | --- | --- | --- |
| 2026-11-26 02:19 | 29.932342 | 0.068 | subscriptions, one activity event, one split, cron ticks since 01:58 (Status script) |
