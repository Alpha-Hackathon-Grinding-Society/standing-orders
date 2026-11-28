# Transaction hashes

Every scripted testnet and mainnet run, with the network, the rule and what it shows. These hashes are Steward's Execution evidence.

Explorers: Base Sepolia https://sepolia.basescan.org/tx/ · Lasna https://lasna.reactscan.net/tx/ · Base https://basescan.org/tx/ · Reactive https://reactscan.net/tx/

## Mainnet showcase: Rule 2 and a full Guardian cycle with real USDC (2026-11-27, released 23:35 UTC)

Approved by the user ("deploy to mainnet", 2026-11-27) with 0.5 USDC and 7 REACT, sent from their main wallet to the PC wallet `0x1501…0502`, which owns this second vault. Settings: a real OpenZeppelin `VestingWallet` vests 0.5 USDC from 18:01 to 21:01 UTC. The Rulebook claims hourly; the Guardian warns after 4 h of silence and releases after 1 h of grace, checked every 15 min on `Cron1000`. The beneficiary is the user's main wallet `0x810f…3276`. Runner: `script/e2e/showcase.sh` (`make showcase-mainnet`).

| Step | Network | Tx | Result |
| --- | --- | --- | --- |
| VestingWallet deploy | Base | [0x29fe1f63…1cb8](https://basescan.org/tx/0x29fe1f63dbf39061b8201898d25859c6448fd3662a9189d2d92dd0b86aab1cb8) | `0x1FF8Ec397C9CeB2c9c78Fac2e8b8C22D9963C831` |
| 0.5 USDC into the vesting wallet | Base | [0xf3b20e02…e5fc6](https://basescan.org/tx/0xf3b20e0244142ce5af09ff8d9e8d4bf175a85390a26f5e5900572f35274e5fc6) | balance 0.5 USDC |
| Rulebook deploy | Reactive | [0xa552f4a4…523c](https://reactscan.net/tx/0xa552f4a41b5cb66d7765e985fc407cfc32a7b4e2777b2167cbd7991c8258523c) | `0x4461142Af87f775242Ff27B0aBB7Ac8b7BFA9686`, 5 REACT. It shares its address with the Base VaultFactory: both are the PC wallet's first contract on their chains. |
| Permit + createVault | Base | [0x04e265b6…80e2b](https://basescan.org/tx/0x04e265b6f970694dc727dacf6ebdd4e14c415adbc84f224dfb32ce21cac80e2b) | vault `0xBBEd82D10845f688CFe3130444f445686A7182a8`, allowance 1 USDC, beneficiary `0x810f…3276` |

Everything below ran on its own: no transaction was sent to the showcase vault, its Rulebook or the vesting wallet after setup. Each row was checked by `node scripts/check-live.mjs --mainnet` (cron-triggered, so there is no origin transaction).

### Rule 2: hourly claims from the VestingWallet (0.5 USDC claimed in three ticks)

| Time (UTC) | Reactive: `ClaimRequested` | Base callback: `ClaimExecuted` | Claimed |
| --- | --- | --- | --- |
| 19:02 | [0x21160c3d…13cc](https://reactscan.net/tx/0x21160c3da6cbcde9c38752579c1c965d178883434402732f7c06321d127d13cc) (nonce 1) | [0xc7c72ff1…565f](https://basescan.org/tx/0xc7c72ff1a5e2dd1a01e99c540d3e695abb3d0614fc9095728c21705273cf565f) | 0.168981 USDC |
| 20:07 | [0x5ec4c07e…2247](https://reactscan.net/tx/0x5ec4c07e2900c5ec3910e19a8ceae067a797815ccbd70baeb5e9c9ec54f72247) (nonce 2) | [0x12df84f3…7fe0](https://basescan.org/tx/0x12df84f3b6c7362a60fb47ff5f5ee1e1660ea08f5f93fce7def4501e70547fe0) | 0.181019 USDC |
| 21:12 | [0x5831bed2…8441](https://reactscan.net/tx/0x5831bed2e6a34c8db11ef0ae22c74f4e21c8a9a974b5ac4200095c7d4e7c8441) (nonce 3) | [0xb6ac9506…b8de](https://basescan.org/tx/0xb6ac9506b431c041672dddd466f9814275997dc2aa5f2669dd0996b68941b8de) | 0.15 USDC (fully vested) |

Two later hourly ticks (22:17, nonce 4; 23:22, nonce 5) found nothing left to release, so the executor returned early (C-2).

### Guardian: Active → Warning → Released

| Time (UTC) | Step | Network | Tx | Result |
| --- | --- | --- | --- | --- |
| 18:02 | Last signed activity (setup) | Base | — | the 4-hour silence clock starts |
| 22:17:33 | Warning | Reactive | [0x2805a468…5870](https://reactscan.net/tx/0x2805a46851af20c5d874450fea727d2fe66900a66e4cbfbf3b20d1bd94a05870) | `GuardianWarning`, on the first 15-minute check past 4 h of silence |
| 23:35:44 | Release | Reactive | [0x22b859ac…6acf](https://reactscan.net/tx/0x22b859ac7fe4b13f2690279e4400621a0678d77b3ade302110f47654bb076acf) | `GuardianReleased` (nonce 6), on the first check past the 1-hour grace; the Rulebook then stops |
| 23:35:46 | Callback | Base | [0x4915d13e…97e7](https://basescan.org/tx/0x4915d13ec468f3b11073418df741f102266e94fa8559c75642efa07b648697e7) | `VaultReleased`, delivered by the callback proxy; 0.5 USDC from the vault to the beneficiary `0x810f…3276`. The vault reads 0.00. |

The Rulebook spent about 0.46 REACT over the evening (5 → 4.54 REACT).

## Phase 4: mainnet vault, Base ↔ Reactive mainnet (2026-11-26)

The user's own wallet `0x810fCBF8A695Ffa0e4480207c667995139F33276` set up Steward from the page and signed every step; no key for it exists on this machine. Shared contracts were deployed by the PC wallet `0x1501…0502`. Callback proxy `0xCc780DdE33f56f55dE778D42c930959374a4a068` rechecked on Reactive's Origins and Destinations page the same day. Settings: 20% of USDC from the listed sender (the user's second account, Steward Payer `0x69Dfdc4f7B27Bbc167C43f7B86A94b318dFA32c9`), at most 5 USDC per 30 days; permit budget 5 USDC; Claim and secure off; Guardian 90 d / 14 d, checked hourly, watching Base and Arbitrum, beneficiary `0x09440538472AaE45AE7e2f509dFf6d23F4b01A08`; `Cron1000`; Rulebook funded with 30 REACT.

### Deployments (`contracts/deployments/base.json`, `rulebook-reactive.json`)

| Step | Network | Tx | Result |
| --- | --- | --- | --- |
| VaultFactory (deploys OrdersExecutor) | Base | [0xf1aa9dcd…3104](https://basescan.org/tx/0xf1aa9dcdffa6df68d919654b6f732dfd4ee41f4e78649f786389ea8d62b43104) | Factory `0x4461142Af87f775242Ff27B0aBB7Ac8b7BFA9686`, executor `0xEaA3CB8cdE5d079CC6da775d21517F7770712036` |
| Heartbeat | Base | [0xffa5f127…977e](https://basescan.org/tx/0xffa5f1276c4e2a317bd25eec9e8e0424fc28713eec6d0a8ee5f538b6294b977e) | `0xFBD66e0C9Db8dA83C45c38AB859D12C228AC6447` |
| Executor callback float | Base | [0x1689cc8f…78b3](https://basescan.org/tx/0x1689cc8f944092c82443e3d73ae1e30b36f9378de1f6bf64d1efcf15055178b3) | 0.00015 ETH |
| Rulebook deploy (signed on the page) | Reactive | [0x184c6be0…10ad](https://reactscan.net/tx/0x184c6be05f99adcd7504726625a9509dbb4c18e4882c8c4dc6c7d3d264ef10ad) | Rulebook `0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a`, 30 REACT |
| Permit + createVault (signed on the page) | Base | [0x1977fc16…5a3d](https://basescan.org/tx/0x1977fc164158bb78d7914caca6233073c56927fa37ef0f7f90e22fcba2a65a3d) | Vault `0xD5f071D9e4E32a2f4004742AFFD77C127f14Dc75`, `UserRegistered`, allowance 5 USDC |
| Guardian activity from the setup | Reactive | [0x3e6fa50e…fd2a](https://reactscan.net/tx/0x3e6fa50e909f4531dc03fb0de1aee6d6b3d2c9b1a320ecb6d4fc9b3179bffd2a) | `ActivityRecorded` on Base |

### First real Rule 1 split (1 USDC from the listed sender → 0.20 USDC saved, 7 Base blocks ≈ 1.4 s from payment to vault; Base blocks are 0.2 s)

| Step | Network | Tx | Result |
| --- | --- | --- | --- |
| Origin: 1 USDC, Steward Payer → user | Base | [0xe98c0af1…cd86](https://basescan.org/tx/0xe98c0af12daabde1f1bc4908d79e452e4ef9d81e2e124adf654034a6d70ccd86) | USDC `Transfer`, block 62,344,797 |
| Reactive: Rulebook reacts | Reactive | [0xf32c83d3…8b81](https://reactscan.net/tx/0xf32c83d342bdd748710f03576c23986b8d4dd9bd521729e1e19074b022558b81) | `SplitRequested`, `originTxHash` = the origin tx above, amount 0.20 USDC, nonce 1 |
| Callback: executor moves the share | Base | [0x95f8b3c1…3eb0](https://basescan.org/tx/0x95f8b3c1e0d4498a2e86b215612d4f69790cd9ce27d7392237e67a96eb383eb0) | `SplitExecuted`, 0.20 USDC into the vault, block 62,344,804 |

### Guardian activity from a second chain: Arbitrum mainnet (2026-11-27)

The owner signed `approve(own address, 0)` on Arbitrum's USDC from MetaMask. It grants nothing, but `Approval(owner = user)` matches the Rulebook's contract-wildcard subscription on Arbitrum. Each one was recorded on Reactive within about a second.

| Step | Network | Tx | Result |
| --- | --- | --- | --- |
| Origin: approval 1 | Arbitrum | [0xd63845c2…84a4](https://arbiscan.io/tx/0xd63845c299bf3023c0a571ba914fbc89eb9d6f22331d921b09be306e1e2e84a4) | `Approval`, 17:12:32 UTC |
| Reactive: Rulebook records it | Reactive | [0x8d99bf34…1401](https://reactscan.net/tx/0x8d99bf34e30adb81882d6a6e472a3fbd982169aa61197d8cd05414a20c181401) | `ActivityRecorded(42161, origin)`, 17:12:33 UTC |
| Origin: approval 2 | Arbitrum | [0x8a813ac0…aa33](https://arbiscan.io/tx/0x8a813ac0f950007a3698f7d4013b2649da362c205f8bf0284b8d06d1d419aa33) | `Approval`, 17:12:45 UTC |
| Reactive: Rulebook records it | Reactive | [0xabbcef97…f183](https://reactscan.net/tx/0xabbcef9766c7816a14cb2930915b030604b311cdaf0bbc0bb20a0ffe0036f183) | `ActivityRecorded(42161, origin)`, 17:12:44 UTC (the two chains' clocks differ by about a second) |

## Phase 5: a vault set up end to end from the page (2026-11-16)

A second MetaMask mobile account, `0xc8180E32107C82E84Ea8a1256Fab39cC616bf0b7`, with no vault and no key on this machine, set up Steward from the Next.js page (`web/`, served on the LAN) and signed every step there. Settings: 20% of USDC from the listed sender `0x1501…0502`, at most 25 USDC per 30 days; permit budget 100 USDC; Claim and secure off; Guardian 90 d / 14 d with beneficiary `0x810f…3276`; `Cron1000`; Rulebook funded with 0.1 lREACT. The account was funded beforehand from the PC wallet with 0.5 lREACT ([0x6ff632f4…ee8c](https://lasna.reactscan.net/tx/0x6ff632f4caf22266676d536a1b8932681db8b847ba4b8859b36ee13eae05ee8c)) and 0.003 ETH ([0x39deafc2…4d43](https://sepolia.basescan.org/tx/0x39deafc2893d124eb5a1f0d0ccfed252ec6bb07b62722de2efa1257d53b84d43)).

| Step | Network | Tx | Result |
| --- | --- | --- | --- |
| Rulebook deploy (signed on the page) | Lasna | [0x4f467cc0…831d](https://lasna.reactscan.net/tx/0x4f467cc0d3dca71f58627638c2fdbb3467e81dc5146daca2652019d3abb3831d) | Rulebook `0x80e7C5958626daAE7e5Be8A99F2E30B2226c7F74`, `splitBps` 2000 |
| Permit + createVault (signed on the page) | Base Sepolia | [0xa6b56620…92bf](https://sepolia.basescan.org/tx/0xa6b56620b4fd2a00d6d03e132f874c4715931f29fbd2fdef196eb53a5f7592bf) | Vault `0xCe5c02d6cEb2340929F00Ef4D2a418DE9cccfC73`, `UserRegistered`, allowance 100 USDC, beneficiary `0x810f…3276` |

**Rule 1 split into the new vault** (10 USDC from the listed sender → 2 USDC saved, under 10 s from payment to vault):

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 1 split | Base Sepolia → Lasna → Base Sepolia | [0x028b6f77…28a1](https://sepolia.basescan.org/tx/0x028b6f771094a4f46e40e2873703a100294b5ac6860827924ce230eb521728a1) | [0x32fcea5a…0136](https://lasna.reactscan.net/tx/0x32fcea5a5b4aae3fe4fb488753c1019fb5ed9cd6228585b6d19feffa88410136) | [0xca46265c…cc88](https://sepolia.basescan.org/tx/0xca46265c602bfd5021a943acce0c3836f36561718983d082581e190cd33bcc88) |

**Everyday actions from the page** (Base Sepolia, each ending `(v) SUCCESS`):

| Action | Account | Tx | Result |
| --- | --- | --- | --- |
| `[ I'M ALIVE ]` | `0x810f…3276` | [0x0e2c3963…96df](https://sepolia.basescan.org/tx/0x0e2c396362ef9e95c8d16a74ae420b9c4bcca1a4427e85418fcbea0f4ea196df) | `Heartbeat.Alive` |
| `[ PAUSE ALL ]` → `[ YES, PAUSE ALL ]` | `0x810f…3276` | [0x6c54d2f8…0afa](https://sepolia.basescan.org/tx/0x6c54d2f821a4cc3bf5bac3ef25cdf11ebf145a9c54e3913b8b9852b3374c0afa) | `OrdersExecutor.Paused` |
| `[ UNPAUSE ]` | `0x810f…3276` | [0x422bb2be…6dfe](https://sepolia.basescan.org/tx/0x422bb2be821b1373810506c4f8fc8de0c7b91be9dc8dc9aa098cf90303c46dfe) | `OrdersExecutor.Unpaused` |
| `[ WITHDRAW ]` 1 USDC | `0xc818…f0b7` | [0x697a2b8c…6dfb](https://sepolia.basescan.org/tx/0x697a2b8cb772e7a7a820a27cae3611014ed8b1e08386c06ec2a9e7e3ef046dfb) | `SavingsVault.Withdrawn`, vault 2 → 1 USDC |

Findings from the run: the page's pre-check refused a wallet address typed as the vesting contract before anything was signed; MetaMask returns error 4100 when the page asks an account the site was not connected with to sign, so the page now tells the user to reconnect with that account ticked.

## Phase 4 rehearsal: setup from a phone wallet on testnet (2026-11-16)

The mainnet setup flow, run on testnet first: the user's MetaMask mobile wallet `0x810fCBF8A695Ffa0e4480207c667995139F33276` signed every step on the setup page (`web/setup`). No key for it exists on this machine. Settings: 20% of USDC from the listed sender `0x1501…0502`, at most 25 USDC per 30 days; permit budget 100 USDC; Guardian 90 d / 14 d; `Cron100`; Rulebook funded with 0.5 lREACT.

| Step | Network | Tx | Result |
| --- | --- | --- | --- |
| Rulebook deploy (signed on the phone) | Lasna | [0x4bb10f46…a4ed](https://lasna.reactscan.net/tx/0x4bb10f468471a19e0ccd25cdce5036c0e087e6b89225979677a1a7ac26b7a4ed) | Rulebook `0x90104E9200e95D46E85c2Bdb14d223A60Ec5D31a` |
| Permit + createVault (signed on the phone) | Base Sepolia | [0x727aba7f…6d63](https://sepolia.basescan.org/tx/0x727aba7fe36cbb667e7e7a226efc1a22c3ccd0b7b8d1bfa872b611f3293e6d63) | Vault `0x074DB6571aCB40D0d19E126C293A5cDC2754b8e9` (as predicted), Rulebook registered, allowance 100 USDC |
| Guardian saw the permit `Approval` as activity | Lasna | [0x7cb6d044…5a92](https://lasna.reactscan.net/tx/0x7cb6d0440d7c66eff5623d354b23b760abaf2b2b5becf85892bb633e8a115a92) | `ActivityRecorded(84532, 0x727aba…)` |

**Rule 1 split into the phone's vault** (100 USDC from the listed sender → 20 USDC saved, about 6 s from payment to vault):

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 1 split | Base Sepolia → Lasna → Base Sepolia | [0xa3260f2e…a5ea](https://sepolia.basescan.org/tx/0xa3260f2e4eea1b53e604574a4f8757ff781e4817431536ccd953a989336ba5ea) | [0x4a9d0e43…ba98](https://lasna.reactscan.net/tx/0x4a9d0e4310126d563d43f95c2f40d9b4a6f609aa58ca9a9df16b1309e991ba98) | [0xbbcb02cf…1a70](https://sepolia.basescan.org/tx/0xbbcb02cfd6036dd4612d764de4ebf646a758edd612ad838a277948df79791a70) |

Finding: MetaMask mobile sent the createVault through its relay (tx `from` `0xB01c…9C2E`, `to` `0xdb9B…7dB3`, the wallet's smart-account delegation), not as a plain transaction from the wallet. The factory still saw the phone wallet as the caller, so the vault owner and registration are correct. Origin-tx senders are therefore not a reliable user signal; Steward's subscriptions filter on event topics (`owner`, `from`, `user`), which is what makes this work. Deploy cost: 3.8 M gas × 100 gwei = 0.38 lREACT on top of the funding value; the phone was topped up with 0.3 lREACT ([0x2a0a1d02…5055](https://lasna.reactscan.net/tx/0x2a0a1d020d7147052a7aa138fa5fa4cc349e7d5343b0d065b3bc49d0c5745055)).

## Phase 3: Rule 2 and the Guardian (2026-11-16)

User `0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502`; beneficiary `0x810fCBF8A695Ffa0e4480207c667995139F33276`. Script: `make e2e-phase3`. Demo timers: `Cron10`, claim every 90 s, silence 180 s, grace 120 s, Guardian check every 30 s. Watched chains: Base Sepolia and Unichain Sepolia.

### Run B: claim, clear, release on one Rulebook (08:16–08:28 UTC)

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 2 claim (cron) | Lasna cron → Base Sepolia | `Cron10` tick (Lasna) | `0x4a62e41b6ec1aeeff33aaf9fa633127397bea829411f9ac3a711edd13ae65129` (`ClaimRequested`) | `0xabf27e8ec64fd6ba9cedcf05a4a266196f7ad7428d632da1eb0d8ba7a6783ce4` (`ClaimExecuted`, 251.67 VEST into the vault) |
| Guardian Active → Warning (silence) | Lasna cron | `Cron10` tick (Lasna) | `0xb2b49600f03332ccb5bbeb508ac508f0492ec7e6420f61232a955f3d00819c15` (`GuardianWarning`) | none |
| Guardian Warning → Active (user acted on the **second chain**) | Unichain Sepolia → Lasna | `0xf73cdb6848b4ec58c7d1ac358c39d6b7a3f1e4a351455969e3a0a6dc0d2d076f` | `0xe86ee39820192c3b5fdba3bc578d4750f43b7c53ed27b019115dbb317c1f9642` (`GuardianCleared`) | none |
| Guardian Active → Warning (silence again) | Lasna cron | `Cron10` tick (Lasna) | `0x3dd434dcad433e64fda16719193d5330ed830dc2de4ac448212a94cfc497a9f1` (`GuardianWarning`) | none |
| Guardian Warning → Released (grace passed) | Lasna cron → Base Sepolia | `Cron10` tick (Lasna) | `0xdf94be3488bbe60d96c4c8e5f94a2861424328b3bc27fc53afa2b2dda6b746da` (`GuardianReleased`) | `0x0e9f2cc81682c7334946b566767b109f02f463c873763be4b4f69b3ab31c99a2` (`VaultReleased`) |

Result: the cron claims moved the whole 1,000 VEST allocation into the vault as it vested. The release sent **all 1,000 VEST to the beneficiary**, and the vault ended empty. The Rulebook is `Released` and unsubscribed: its lREACT balance has stayed at 0.690397 since. The run spent 0.81 lREACT.

| Contract | Network | Address | Deploy tx |
| --- | --- | --- | --- |
| VaultFactory (deploys OrdersExecutor) | Base Sepolia | `0x207feeecD8b2f6F479be2Ed591F309F06501F0cc` | `0x71c1d6fa0cba4f2d59ef562c28fce1e03c5a4a74c0f726958603fd69a073b2d2` |
| OrdersExecutor | Base Sepolia | `0x12B9D62B13e626163114588DCBa51C6a7B88CCEC` | same tx; funded in `0x60ab915271a1e2d87ff22e3293d9ca4dc54bd7c55df973651b0525839df838cf` |
| Heartbeat | Base Sepolia | `0xe6847bA8f223c74f64f8C317dB5a40A848740EA8` | `0x62b3eaa0f8e480fc750942eed386defd20cff99202e49f5830d3d6f6f7efd0c5` |
| MockUSDC | Base Sepolia | `0x12E627587Ef1d653014AE6ABf9759DB2Ee5C1F2a` | `0x5e3a12c0d5b5b9775793da3ac633bad88ba95cfe37791a30e9c3e86942d3691f` |
| VEST token / MockVestingWallet (OpenZeppelin code, 600 s) | Base Sepolia | `0x9fE6f72119507f969b7094A3f4e8EB5c58147650` / `0x1676537eB66d4A29925F37B30C6476e13Dc1DdeB` | see `broadcast/Phase3.s.sol/84532/` |
| One-time VEST approval for the executor | Base Sepolia | | `0x62ebe11b7bc764c48377a530a05ad5451b4f22d3c0736b46496f553d61be9634` |
| Rulebook (all three rules) | Lasna | `0x6dd3321B7881B026b13120b605e82815eCe89544` | `0xdec5b10ffb17483e92c3dfb925a21b033f90e3a92009a5258b87beb45923a9d5` |
| SavingsVault (permit + `createVault`) | Base Sepolia | `0x3f6Add291E6f02A9BD3d7345F6102Ddf9E7F1707` | `0x16266260efd886d217c7e6640a55d95b2a3c5c86103deff5c52c4c0dd30c3f09` |

### Run A: an unattended Guardian cycle (2026-11-15, 22:55 UTC)

The first attempt lost its terminal session right after setup, before the one-time VEST approval was sent. The Rulebook carried on alone:
- Its four claims failed on Base (no approval).
- It warned after 3 minutes of silence.
- It released after the 2-minute grace, with the vault empty.
- It unsubscribed, keeping 1.99 lREACT.

Contracts are in `contracts/deployments/*.phase3a.json`.

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Last signed activity: the vault's USDC permit (`Approval` by the user) | Base Sepolia → Lasna | `CreateVault` tx | `0xa2cf6e758da34755f5f5d7c5b30e46f22a18489a362ee3fcf8c56107ccc15757` (`ActivityRecorded`) | none |
| Guardian Active → Warning | Lasna cron | `Cron10` tick | `0x1e6173057fe7868a09e12e0122273f739d4d2d04e36ca15bfeb97213d506df7d` | none |
| Guardian Warning → Released | Lasna cron → Base Sepolia | `Cron10` tick | `0x7f801e8e9c369f5f7b72739ce3d7e169578219295884a3f072c2f2bb6e6d5053` | `0xe0cf2dbf89101ca6f3da41595e077ddf842cfae4d32ca2417b91fed1254ad4b4` (`VaultReleased`, nonce 5) |

## Phase 2: Rule 1, pay yourself first (2026-11-15)

User (deployer) `0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502`. Script: `make e2e-rule1`. Two test employers each paid the user 100 test USDC. The Rulebook lists only the first, with a 20% split and a 100 USDC cap per 30 days.

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Rule 1 split (listed sender) | Base Sepolia → Lasna → Base Sepolia | `0x36a4200afdf67756bb09d2f24dcfba16862ba0ad182acc5f7c851904dc460095` | `0xda7a63891d09d89812ac5e164a0321437b54f8bcb8fec7fda8660bc2b25a2dc5` (`SplitRequested`) | `0x5dfcca7df4f273fcbe0ced13abde6e527b59f9dc3128d37979d79be6e58c53b0` (`SplitExecuted`) |
| Rule 1 ignored (unlisted sender) | Base Sepolia → Lasna | `0x0c02b7c6415dd4ed7552102742b145401bb67d7eb3cfe49e60a561842d139798` | `0xce4582125e24c26069381b96d52de0cab9bbd0b27727d9d7f0f84ef42c890c46` (`IncomeIgnored`) | none, by design |

Result: vault balance 0 → **20.000000 USDC**, exactly 20% of the listed payment. The unlisted payment reached the Rulebook and produced no callback. The callback landed 8 Base Sepolia blocks (~2 s) after the origin tx.

### Deployments (Base Sepolia, `contracts/deployments/base-sepolia.json`; Lasna, `rulebook-lasna.json`)

| Contract | Network | Address | Deploy tx |
| --- | --- | --- | --- |
| MockUSDC | Base Sepolia | `0xCd9f66e15272cf3979c4e7fdd64A358A0e6cf913` | `0x7cb12ef40e5c3b0f94a3ca3ff4c7562e716848f4cc6f97d86b9fa501645ed115` |
| VaultFactory (deploys OrdersExecutor) | Base Sepolia | `0x6827BA82fd12aA867E5e90a2eb9bDa2CA3Bd82af` | `0xf27bf0067cc738fe49d6700ea2df6b2820c9dbeda4fa7cf00dafad69cc8fd2ab` |
| OrdersExecutor | Base Sepolia | `0x0736566E3E0752638F572Ba417adEA34288BF92B` | same tx as the factory; funded with 0.001 ETH in `0xd05ecde6af797626dbde10a84f152abb35c657699c0685fa5928532099a28688` |
| Heartbeat | Base Sepolia | `0x8D596aEAE3a061b45647bFDc59af1B4ceb86F244` | `0xebd7cc1a99767b07983e775de6838f5e73c453b923cc140b438005dce9757b2f` |
| MockPayer (listed employer) | Base Sepolia | `0x8e836Dde6681cC7a1b8DEAB589101E2E05482c39` | `0xafcce8f7339913f9ee41ca3cb82073c23b6fc3c4895edb2b59e122b7aec379ff` |
| MockPayer (unlisted) | Base Sepolia | `0x48426FA16ab8D6eF4780Df22ab8D6c4Ae080734B` | `0xfeb8b17bd361c08a46aa0f788693610a3430dc626917bd002f78d13836cf5c56` |
| Rulebook (user's, `Cron100`) | Lasna | `0x1Ad42B72F76BE45be36daa04292d5E1397E902B7` | `0xda2b811ecbdbed079ca36aac4816107fce0a65571a4e973f05617d8e68a5d1c9` |
| SavingsVault (user's, via `createVault` + permit) | Base Sepolia | `0x27288a3594086bFB1DD260aa330b3fdAfEaED371` | `0xd9cb39da8afcb9a0eeef6e7f4776a030def93c585970374e39116fc58f4a7f31` |

## Phase 1: hello loop and cron (2026-11-15)

Deployer `0x1501D3884C2bEBefBfe4D4B3D026E84c9Cfb0502` on both chains. Scripts: `make e2e-hello`, `make e2e-hello-cron`.

### Full reactive loop: Base Sepolia → Lasna → Base Sepolia

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Hello loop (run 2, success) | Base Sepolia → Lasna → Base Sepolia | `0xc2011d6f734efc46e7f8916fff02088d95978338bdea7c44db72ce9b595b2d0c` | `0x67e2655cc92b6c2e5338d6452f4848f8aac648a32955aa26dec83c6dd7ffaa88` | `0x57e06841b244534ada9b65bdde81ab8ffbe4510f3904ce14b2194bc4d554a1f6` |
| Hello loop (run 1, delivered but `ping` ran out of gas) | Base Sepolia → Lasna → Base Sepolia | `0x969a0867a1718aded6ae819cd2001adb311ea30cdbfb4b2588caffd8d0e6646a` | `0xda0df9bc09d9b3a35cbd92aeed38694cb4bc831fe3ce1a8a79512c6c64a4af63` | `0x965a94842ad75210d7ed4beafc1c0a9b7aeef890d6f48d978e0f4c48d6051c89` (`CallbackFailure`) |

- Run 2: a 100 test-USDC transfer on Base Sepolia. `HelloReactive` saw it on Lasna and requested a callback, and `HelloReceiver.ping` stored it (`pingCount = 1`). The callback landed 6 Base Sepolia blocks (~1 s) after the origin tx.
- **Injected sender in both runs = the HelloReactive contract** (`0xB49e…82BA` in run 2, `0x4461…9686` in run 1), not the deployer wallet.
- Run 1 shows why the callback gas limit must cover the proxy's overhead (NOTES §11).

### Contract wildcard filtered on the user (Guardian subscription shape)

`WildcardProbe` `0x1FF8Ec397C9CeB2c9c78Fac2e8b8C22D9963C831` subscribes to `Transfer(from = user)` and `Approval(owner = user)` on **any** Base Sepolia contract. The token below was deployed after the probe, so only the wildcard could match it.

| Rule | Network | Origin tx | Reactive tx | Callback tx |
| --- | --- | --- | --- | --- |
| Wildcard: `Approval` by user on an unnamed token | Base Sepolia → Lasna | `0x0f05438715572e2a4f441ff0508a3e05d3e5377456cd9486a38d165db42f1ac0` | `0x7a7b73bea35d5170ab371f7af5d62b96ab573a01b8bbeae9f01c71f926454a6c` | none (probe only) |
| Wildcard: `Transfer` from user on an unnamed token | Base Sepolia → Lasna | `0x4e45fa0dac2dfd56ab34ed0dcff26a4f5a43cf70ef2e065cecbd75631bf16f99` | `0x952de17684c2669cb5e296aea96467f5c0c132d6134a73dd9b3465681e32de83` | none (probe only) |

The mint on the same token (`0x06a5f4a0…313e`, `from = 0`) correctly produced no reaction.

### Deployments

| Contract | Network | Address | Deploy tx |
| --- | --- | --- | --- |
| MockUSDC (run 2) | Base Sepolia | `0x1Ad42B72F76BE45be36daa04292d5E1397E902B7` | `0xf43365a115434fe561cb46f22a6e6b9610540e6f65403068ebf01d3a90ba2abe` |
| HelloReceiver (run 2) | Base Sepolia | `0x4e0db3bCF8B8AAb8195b017Ff9937fBFEf11Fedc` | `0xacbd22d50def4c9cbbe12ad49ed1c41369b6524453e8871a6e152afeaaf35e09` |
| HelloReactive (run 2, no cron) | Lasna | `0xB49e963e120814A1a8182d759923349e75dB82BA` | `0x53c8d348cd80783fe3f46bceccfa8bb53dbbe782d6429aac2bf80d47e37abb47` |
| HelloReactive (run 1, Cron10) | Lasna | `0x4461142Af87f775242Ff27B0aBB7Ac8b7BFA9686` | `0x451ea45ba022fbbb97cfb5a6cece9d11ddfc491c7688df066c29c7c4bf3daed9` |
| `stopCron()` on run 1 (direct owner call to a reactive contract) | Lasna | | `0x677748a2512dc3b29c6723e1d291fe2ee543a8f1eee82dc0d94787781f112a79` |
| WildcardProbe | Lasna | `0x1FF8Ec397C9CeB2c9c78Fac2e8b8C22D9963C831` | `0xf0875aa6961f739153b42131cae660f6f4ba82b1bcdaa6bf4c0dbbcdc50e1b17` |

Run 1 Base Sepolia contracts are in `contracts/deployments/hello-base-sepolia.run1.json`.

### Cron ticks (`Cron10`, run 1 HelloReactive)

68 ticks between 19:30:17 and 19:42:05 UTC. Mean interval 10.6 s (every 10 Lasna blocks), and each tick was charged 0.0121971 lREACT; the first tick cost 0.0156 because of cold storage. Ticks stopped two ticks after `stopCron()`.

<details>
<summary>All 68 ticks</summary>

| # | Lasna block | Timestamp (UTC) | Interval (s) | Charged (lREACT) | Reactive tx |
| --- | --- | --- | --- | --- | --- |
| 1 | 8432001 | 2026-11-15T19:30:17.000Z |  | 0.0156171 | 0x11609abf35ae7b8e7e6cf9bab143777cdf1197fc8caf3a6c07f86f53ad72dd12 |
| 2 | 8432011 | 2026-11-15T19:30:27.000Z | 10 | 0.0121971 | 0x795d73cf7c0f447a7d4027c34665745028d03e067ce22a4e5c87481bc69417c7 |
| 3 | 8432021 | 2026-11-15T19:30:38.000Z | 11 | 0.0121971 | 0x097a04c39ea0c0b0a8931915e98a266634b7b10b9ecb5755de031b761e13be7a |
| 4 | 8432031 | 2026-11-15T19:30:49.000Z | 11 | 0.0121971 | 0x414aa5b5533ebf22b4d136845a3cfe9831dfd38a9b1e1d27e5efcc736b516d37 |
| 5 | 8432041 | 2026-11-15T19:30:59.000Z | 10 | 0.0121971 | 0x963599bb06de2c18a552f5d41e165120190da09e6e5e5e20b923f0893f5f498f |
| 6 | 8432051 | 2026-11-15T19:31:10.000Z | 11 | 0.0121971 | 0x289fcfade150089a05c0f3821fc5dec08ea108018bdd11c21fb444725cff1d8f |
| 7 | 8432061 | 2026-11-15T19:31:20.000Z | 10 | 0.0121971 | 0x3360f2316281c1abc64d657bdd67c5059c95246349dada0a6f7471e669b52fdb |
| 8 | 8432071 | 2026-11-15T19:31:31.000Z | 11 | 0.0121971 | 0x35b9762743c00e986919fe2bf7e5f1575e106d37acc2ba893d1d94ad1c4925e3 |
| 9 | 8432081 | 2026-11-15T19:31:42.000Z | 11 | 0.0121971 | 0xda7dd39ea9cd08f6965e79cf364a0ecd44679f275973a3df292a851a99d6dd61 |
| 10 | 8432091 | 2026-11-15T19:31:52.000Z | 10 | 0.0121971 | 0x305645e2943376eb10c54286399c94a438f30fd467abd9e3dd7956cff5aa5d82 |
| 11 | 8432101 | 2026-11-15T19:32:03.000Z | 11 | 0.0121971 | 0x5be89036582bfd4b4b2d705d91193b4d33eafba6b5dc20a6701fa8d4bde07fbd |
| 12 | 8432111 | 2026-11-15T19:32:13.000Z | 10 | 0.0121971 | 0xa0c49adc15d9f8854f35271a42efc21902534783f62647ef506501198b415d86 |
| 13 | 8432121 | 2026-11-15T19:32:24.000Z | 11 | 0.0121971 | 0x50f8528fbf4c15fd0a65098628a3f172cc5a63cda58aa0a8e52898eaf979842e |
| 14 | 8432131 | 2026-11-15T19:32:34.000Z | 10 | 0.0121971 | 0x348ea5e27ba65c5b6410b81820417d708026d6ca163cdcb407b43260b02d911b |
| 15 | 8432141 | 2026-11-15T19:32:45.000Z | 11 | 0.0121971 | 0x162ff32c696ae168e744761eeadadfbd5f2a4a6cf0b1d3c8497d922c8212210d |
| 16 | 8432151 | 2026-11-15T19:32:55.000Z | 10 | 0.0121971 | 0x504be3934951665c5d4b7c23ae9d44825b4bb9a9194b122e71243e5672b4ba5e |
| 17 | 8432161 | 2026-11-15T19:33:06.000Z | 11 | 0.0121971 | 0x3e1c4ceffdb9e306e9fe7d5fb8f2d74151869391c08f56272fe9576960bad1c1 |
| 18 | 8432171 | 2026-11-15T19:33:16.000Z | 10 | 0.0121971 | 0x9ff96df6b7c4c2867112189c27562bec7e41b95f34ec0114b294c8ac80a68fa9 |
| 19 | 8432181 | 2026-11-15T19:33:27.000Z | 11 | 0.0121971 | 0xc3b995a0081e6f4a18f67458cc198ae94bedc054e5718cde80bbf09e7127dff6 |
| 20 | 8432191 | 2026-11-15T19:33:37.000Z | 10 | 0.0121971 | 0xb540634986ec8aea6a9d2f2051c8fb1e5149e0efcd3c73012efa8f35bd691e05 |
| 21 | 8432201 | 2026-11-15T19:33:48.000Z | 11 | 0.0121971 | 0x66752746ea1978dfb019bc3b13386a20959ad536d82a13e88c2b52b829bcecb1 |
| 22 | 8432211 | 2026-11-15T19:33:58.000Z | 10 | 0.0121971 | 0x1d285ae87f24e8af6357aa2be4cfa8e27dfa88310e3767c573324a7857e40429 |
| 23 | 8432221 | 2026-11-15T19:34:09.000Z | 11 | 0.0121971 | 0xa1e67717fc0800c1f115dc2af47e754011c57749f70446d68beef4e57faf9602 |
| 24 | 8432231 | 2026-11-15T19:34:19.000Z | 10 | 0.0121971 | 0xbbfb6855e2a4a518386c88a1bad31c58e4bb39078c441e8777e6420d85dc7e5b |
| 25 | 8432241 | 2026-11-15T19:34:30.000Z | 11 | 0.0121971 | 0xd24da026788f6799db026f727558b80a86c6d42812755a653f248a6951a90e68 |
| 26 | 8432251 | 2026-11-15T19:34:40.000Z | 10 | 0.0121971 | 0x05bfcf76eb11183caed52a2ec54541cc458a92f90d1be2117a0744dbb752dbfb |
| 27 | 8432261 | 2026-11-15T19:34:51.000Z | 11 | 0.0121971 | 0x223c71cf053be87a7555377cab288472371f23fc17d9f57927f11ebda8f1a850 |
| 28 | 8432271 | 2026-11-15T19:35:02.000Z | 11 | 0.0121971 | 0xd709b72d584b60e0ec24ea331c41c092f34912f9aa0a00e929918c33ed8f6bac |
| 29 | 8432281 | 2026-11-15T19:35:12.000Z | 10 | 0.0121971 | 0xb19533db03a9d6d4241ddc035d6686ce1d9d1806d962a16de1f92eae6455b207 |
| 30 | 8432291 | 2026-11-15T19:35:23.000Z | 11 | 0.0121971 | 0x3062974c0fdc64e8d22a92884453ea5bab7afb45242dcf2f71331296253dd682 |
| 31 | 8432301 | 2026-11-15T19:35:33.000Z | 10 | 0.0121971 | 0x9fbb54948587c3ab2fa3d038eab15698269165d8acc6d5e76ad5afc9fbae8a4e |
| 32 | 8432311 | 2026-11-15T19:35:44.000Z | 11 | 0.0121971 | 0xb96919abb3fdf24594caa6f169a5e042c5a64955b7ca62dc6853da26100b5639 |
| 33 | 8432321 | 2026-11-15T19:35:54.000Z | 10 | 0.0121971 | 0x0314323adfb31110d7df021563282edf184582656e1398073a0ace121718ba18 |
| 34 | 8432331 | 2026-11-15T19:36:04.000Z | 10 | 0.0121971 | 0x14a5c00f636744bd21490b2206df312a1c5da27bbd886a6466d6ebf83f14061b |
| 35 | 8432341 | 2026-11-15T19:36:15.000Z | 11 | 0.0121971 | 0x441e5e4c57b4f5acbf5db222f55dbc025a65606a13a4a94be821b837aed611e8 |
| 36 | 8432351 | 2026-11-15T19:36:25.000Z | 10 | 0.0121971 | 0x918d6d2846348b6be5d428f37fe7e96b7cc12db452bbc213b3de02fc93428cea |
| 37 | 8432361 | 2026-11-15T19:36:36.000Z | 11 | 0.0121971 | 0xba9c403b7f5c9a5e74f623499a21471513269ad74c65f1c558d380e81e870f19 |
| 38 | 8432371 | 2026-11-15T19:36:46.000Z | 10 | 0.0121971 | 0xc433128a415aed3b4a4109a5cabddcd144f048c64bfcbbf4b3e1646dbe10445d |
| 39 | 8432381 | 2026-11-15T19:36:57.000Z | 11 | 0.0121971 | 0xecab0b9b7bf4f7a3f651524c49ce916dd05442dc80e27154c5cbc52d8a03f37f |
| 40 | 8432391 | 2026-11-15T19:37:08.000Z | 11 | 0.0121971 | 0x01a0bca405071080ac38af69eb7c34e9909a6dd8c4c2c6330d2f706bd95b2265 |
| 41 | 8432401 | 2026-11-15T19:37:19.000Z | 11 | 0.0121971 | 0x4ce2735b2ac616fc3114181aae86bfd4711389f0eeaafe8ec1a42cf702b29626 |
| 42 | 8432411 | 2026-11-15T19:37:29.000Z | 10 | 0.0121971 | 0x3813c2858c8aed9aa21a31abc8ef615ed649b065bf537328e6fa6c3edefcddaa |
| 43 | 8432421 | 2026-11-15T19:37:40.000Z | 11 | 0.0121971 | 0x477be1227c97cc3faa40b6a4e4c5be6855e9d49080fadba949ea5b25841f4f94 |
| 44 | 8432431 | 2026-11-15T19:37:51.000Z | 11 | 0.0121971 | 0xde62e7fc2458b35c30326adb5a6a42ac418067f81cce2cd61f5a4534189f3fb5 |
| 45 | 8432441 | 2026-11-15T19:38:01.000Z | 10 | 0.0121971 | 0x884f7258961fed6668173bc4233499609a4a31a1b418eb10dee880b214d3f0a0 |
| 46 | 8432451 | 2026-11-15T19:38:12.000Z | 11 | 0.0121971 | 0xbd67fee5392fa042556c50d94ada67af5daa4d0dcd11ac73e52fac86e715e509 |
| 47 | 8432461 | 2026-11-15T19:38:22.000Z | 10 | 0.0121971 | 0x42a9c16af3af9dd5ba8042d3b155f566d6a5ce548eb6035a6de0b0aa34175782 |
| 48 | 8432471 | 2026-11-15T19:38:33.000Z | 11 | 0.0121971 | 0x0280561d8b61302b35b4ff97ca863e07779ad366105ebd4fde5123124c68196f |
| 49 | 8432481 | 2026-11-15T19:38:44.000Z | 11 | 0.0121971 | 0xf273f22859a8d4110275f1358010eca90188534b7bdac0f34c2852f56503fd66 |
| 50 | 8432491 | 2026-11-15T19:38:54.000Z | 10 | 0.0121971 | 0x8c5da4b9964758a9c0f1f85545263604f97078a0b988b99f044a0aed799b059b |
| 51 | 8432501 | 2026-11-15T19:39:05.000Z | 11 | 0.0121971 | 0x9d60f6395a20a2a418002a914571f1685f4c532b2e7a420a9cf5b8e32cc652a3 |
| 52 | 8432511 | 2026-11-15T19:39:16.000Z | 11 | 0.0121971 | 0xff498e486fccdda76464bea10bd3e7ecbcc40b2b9fb5a41ae4d139f6573481c2 |
| 53 | 8432521 | 2026-11-15T19:39:26.000Z | 10 | 0.0121971 | 0xc059076e2e40ec97034b9c3017ca23419d5dbc16e23a27c19ae6f4ff9cada589 |
| 54 | 8432531 | 2026-11-15T19:39:37.000Z | 11 | 0.0121971 | 0x655f196ce1753d1ea3d55d3508b899bff63ed8e821002c161520d47d0969ca04 |
| 55 | 8432541 | 2026-11-15T19:39:48.000Z | 11 | 0.0121971 | 0x19eca363be95d5d1c41ae4cd3aaa00d41950740a4bb44bb5f5ffe7e28fc6a2ba |
| 56 | 8432551 | 2026-11-15T19:39:58.000Z | 10 | 0.0121971 | 0x933128c8adbb7400dd3aa3dad1d0762904493960f8e883e0c0320e75e81842cb |
| 57 | 8432561 | 2026-11-15T19:40:09.000Z | 11 | 0.0121971 | 0xf23accbb4f068c40c176a2158bee8ecaee741aa6a10ac1eae57404d6c96e1bd3 |
| 58 | 8432571 | 2026-11-15T19:40:20.000Z | 11 | 0.0121971 | 0x4a40c586aa9798df9584da4c6706ec06a6266061b7fd34ef8d17c533e6504763 |
| 59 | 8432581 | 2026-11-15T19:40:30.000Z | 10 | 0.0121971 | 0x8788516dc6bcad7dde9118dcebfd9003f4da193298bbc15f17fb02de8f7019ea |
| 60 | 8432591 | 2026-11-15T19:40:41.000Z | 11 | 0.0121971 | 0x7abc2169c0a3439c34cbd9dba9be2849805427f75c098972a8297f456baf98fc |
| 61 | 8432601 | 2026-11-15T19:40:52.000Z | 11 | 0.0121971 | 0x47f6434c72325b235c73796e891378aa4e359847efed2856d717c65cd8331d6a |
| 62 | 8432611 | 2026-11-15T19:41:02.000Z | 10 | 0.0121971 | 0x2adc0e75c980e0721c3dd75481b06b5d76ded9a1567835d54fe682750d6b5d8a |
| 63 | 8432621 | 2026-11-15T19:41:12.000Z | 10 | 0.0121971 | 0xec7f7acb1763b05356ab582a0e73007c52733573a0891c556ff239de20013d0f |
| 64 | 8432631 | 2026-11-15T19:41:23.000Z | 11 | 0.0121971 | 0x2367870743c75bef8d9c814fc47a6153107350cab5c335bd71baa359cac150a0 |
| 65 | 8432641 | 2026-11-15T19:41:34.000Z | 11 | 0.0121971 | 0xc53da3a268f9e7508579403e9e49e6a91b80ff99c65bce2f3e31608225cad7fa |
| 66 | 8432651 | 2026-11-15T19:41:44.000Z | 10 | 0.0121971 | 0x46565bf61eda66c0ded2d4616a89e58fb20bee4a5fb06b3d2e25e143d44fffe2 |
| 67 | 8432661 | 2026-11-15T19:41:54.000Z | 10 | 0.0121971 | 0xb768121fbe5720a506cc41f1f478db0fb18228a4bee23b16b6be5d4309abe3fc |
| 68 | 8432671 | 2026-11-15T19:42:05.000Z | 11 | 0.0121971 | 0xa2170b948cd016f7d2ee0392fe2b1647c1416b1be76df1a775107610a93460be |

</details>
