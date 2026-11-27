# Mainnet usage

Steward's real vault on Base mainnet, owned by the builder's own wallet `0x810fCBF8A695Ffa0e4480207c667995139F33276`, running from **2026-11-26**. Every row is a real action with its hashes. Explorers: Base https://basescan.org/tx/ · Reactive https://reactscan.net/tx/

- Vault `0xD5f071D9e4E32a2f4004742AFFD77C127f14Dc75` (Base) · Rulebook `0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a` (Reactive mainnet)
- Rules: 20% of USDC from `0x69Df…32c9`, at most 5 USDC per 30 days; Guardian 90 d / 14 d, hourly, Base + Arbitrum; `Cron1000`
- Small, unaudited amounts only: permit budget 5 USDC.

## Rule actions

| Date (UTC) | Rule | Origin (Base) | Reactive | Callback (Base) | Amount saved |
| --- | --- | --- | --- | --- | --- |
| 2026-11-26 02:15 | Pay yourself first | [0xe98c0af1…cd86](https://basescan.org/tx/0xe98c0af12daabde1f1bc4908d79e452e4ef9d81e2e124adf654034a6d70ccd86) | [0xf32c83d3…8b81](https://reactscan.net/tx/0xf32c83d342bdd748710f03576c23986b8d4dd9bd521729e1e19074b022558b81) | [0x95f8b3c1…3eb0](https://basescan.org/tx/0x95f8b3c1e0d4498a2e86b215612d4f69790cd9ce27d7392237e67a96eb383eb0) | 0.20 USDC |
| 2026-11-26 02:44 | Pay yourself first | [0xc148e0f4…0925](https://basescan.org/tx/0xc148e0f4084b8ec28066dd0af587e3a4d47e4e9f40f0b279ed6f8e87c1ea0925) (0.18 USDC) | [0xfd3a3206…45fb](https://reactscan.net/tx/0xfd3a3206cc94e2f4c2a089a2a121fb246c566232c1f7357a191f0611a4f745fb) | [0xf9b9812b…7b0f](https://basescan.org/tx/0xf9b9812bf9c873d8093044727cd483c77ed381fb05026c3454b6bd4ffbb67b0f) | 0.036 USDC |
| 2026-11-26 | Guardian: I'm alive | [0x7f090f8f…5696](https://basescan.org/tx/0x7f090f8fe730f4bb4d90c18eb3c06807708ec5ad503d3c674f9f4bf4257d5696) (`Heartbeat.alive`) | [0xeac133f9…4a42](https://reactscan.net/tx/0xeac133f9259ae9abfc3fb37c019b1927f1823e7c1e042dd80fe619c2722f4a42) (`ActivityRecorded`, Base) | — (no callback needed) | clock reset |
| 2026-11-27 17:12 | Guardian: activity on Arbitrum (a signed zero-value USDC approval to the owner's own address) | [0xd63845c2…84a4](https://arbiscan.io/tx/0xd63845c299bf3023c0a571ba914fbc89eb9d6f22331d921b09be306e1e2e84a4) (Arbitrum) | [0x8d99bf34…1401](https://reactscan.net/tx/0x8d99bf34e30adb81882d6a6e472a3fbd982169aa61197d8cd05414a20c181401) (`ActivityRecorded`, chain 42161) | — (no callback needed) | clock reset; Arbitrum now "seen" |
| 2026-11-27 17:12 | Guardian: a second Arbitrum approval, 13 s later | [0x8a813ac0…aa33](https://arbiscan.io/tx/0x8a813ac0f950007a3698f7d4013b2649da362c205f8bf0284b8d06d1d419aa33) (Arbitrum) | [0xabbcef97…f183](https://reactscan.net/tx/0xabbcef9766c7816a14cb2930915b030604b311cdaf0bbc0bb20a0ffe0036f183) (`ActivityRecorded`, chain 42161) | — | clock reset |
| 2026-11-26 | Rule 1 ignored an unlisted sender | origin `0x9b0f9307…b960` (0.000011 USDC from `0x69dfE1dB…A03232C9`) | [0xf354c113…c7b9](https://reactscan.net/tx/0xf354c11354e969143e7d550397dea80a36d0911e74ca4a5aed8391c65ff9c7b9) (`IncomeIgnored`) | — | nothing, as designed |

The ignored payment was an address-poisoning attempt: dust from an address made to look like the listed sender `0x69Df…32c9` (same first and last characters). Rule 1 matches the full address, so it saved nothing.

## Second vault: the mainnet showcase (from 2026-11-27 17:57 UTC)

A small second vault owned by the builder's PC wallet `0x1501…0502`, set up to show Rule 2 and the Guardian's full cycle on mainnet within one evening. It holds a real `VestingWallet` with 0.5 USDC, and its beneficiary is the builder's main wallet. Setup hashes and every step are in `docs/TX_HASHES.md` ("Mainnet showcase").

## REACT spent

Rulebook funded with 30 REACT at 01:58 UTC on 2026-11-26 (deploy fee paid separately by the wallet). Read the balance with `make status NET=reactive`, or with no keys at all, `make check-live`.

| Date (UTC) | Rulebook REACT | Spent since previous | Note |
| --- | --- | --- | --- |
| 2026-11-26 02:19 | 29.932342 | 0.068 | subscriptions, one activity event, one split, cron ticks since 01:58 (Status script) |
| 2026-11-26 03:00 | 29.858159 | 0.074 | a second split, one I'm alive, one ignored payment, cron ticks |
| 2026-11-26 07:43 | 29.599389 | 0.259 | quiet: cron ticks only (≈ 1.3 REACT/day); read by `make check-live` |
| 2026-11-27 17:16 | 27.754757 | 1.845 | 33.5 h: cron ticks, three activity events (two from Arbitrum); ≈ 1.32 REACT/day |
