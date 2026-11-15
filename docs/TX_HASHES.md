# Transaction hashes

Every scripted testnet and mainnet run, with the network, the rule and what it shows. These hashes are Steward's Execution evidence.

Explorers: Base Sepolia https://sepolia.basescan.org/tx/ · Lasna https://lasna.reactscan.net/tx/ · Base https://basescan.org/tx/ · Reactive https://reactscan.net/tx/

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
