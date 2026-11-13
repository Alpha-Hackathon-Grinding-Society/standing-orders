# Progress

One report per phase, newest last. Template in CLAUDE.md.

## Phase 0 report: Setup

Gate: PASSED on branch `devops` (CI run 43456412724). The "CI passes on `main`" criterion completes when the `devops` → `main` PR is merged.

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
