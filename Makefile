# Steward: one entry point for build, test and deploy.
# Contract commands run in contracts/. Deploy and e2e targets load .env if present;
# scripts read PRIVATE_KEY themselves, so no key ever appears on a command line.

-include .env
export

FORGE := cd contracts && forge
SCRIPT := cd contracts && forge script

.PHONY: help install build test test-fork fmt fmt-check coverage slither clean \
	deploy-base-sepolia deploy-rulebook-lasna create-vault-base-sepolia deploy-base deploy-rulebook-reactive \
	deploy-hello-base deploy-hello-lasna hello-stop-cron \
	e2e-hello e2e-hello-cron e2e-rule1 e2e-phase3 e2e-claim e2e-guardian-clear e2e-guardian-release \
	alive pause unpause withdraw propose-beneficiary apply-beneficiary propose-cold-wallet apply-cold-wallet \
	edit-rules top-up-react withdraw-react check-now status pay-test-usdc \
	web-install web-sync web-dev web-check web-e2e check-live

help: ## List targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-26s %s\n", $$1, $$2}'

# ---------------------------------------------------------------- build and test

install: ## Fetch the pinned submodules
	git submodule update --init contracts/lib/forge-std contracts/lib/openzeppelin-contracts contracts/lib/reactive-lib-omni

build: ## Compile contracts
	$(FORGE) build --sizes

test: ## Run unit, fuzz and invariant tests (fork tests skip unless BASE_RPC is set in the shell)
	$(FORGE) test -vvv

test-fork: ## Fork tests against Base mainnet (real USDC)
	cd contracts && BASE_RPC=$(BASE_RPC) forge test --match-path "test/fork/*" -vv

fmt: ## Format Solidity
	$(FORGE) fmt

fmt-check: ## Fail if Solidity is not formatted
	$(FORGE) fmt --check

coverage: ## Line and branch coverage of src/
	$(FORGE) coverage --no-match-coverage "(test|script|lib)/" --report summary

slither: ## Static analysis (needs: pip install slither-analyzer)
	cd contracts && slither . --filter-paths "lib/|test/|script/"

clean: ## Remove build output
	$(FORGE) clean

# ---------------------------------------------------------------- deploy (testnet)

deploy-hello-base: ## Phase 1: MockUSDC + HelloReceiver on Base Sepolia (run before deploy-hello-lasna)
	$(SCRIPT) script/hello/DeployHelloBase.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast --slow

deploy-hello-lasna: ## Phase 1: HelloReactive on Lasna at the address HelloReceiver expects
	$(SCRIPT) script/hello/DeployHelloReactive.s.sol --rpc-url $(LASNA_RPC) --broadcast --slow

hello-stop-cron: ## Phase 1: unsubscribe HelloReactive from cron
	$(SCRIPT) script/ops/HelloStopCron.s.sol --rpc-url $(LASNA_RPC) --broadcast

deploy-base-sepolia: ## Phase 2: executor, factory, heartbeat, MockUSDC on Base Sepolia
	$(SCRIPT) script/DeployBase.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast --slow

deploy-rulebook-lasna: ## Phase 2: your Rulebook on Lasna (set INCOME_SENDERS); run before create-vault-base-sepolia
	$(SCRIPT) script/DeployRulebook.s.sol --rpc-url $(LASNA_RPC) --broadcast --slow

create-vault-base-sepolia: ## Phase 2: permit + createVault on Base Sepolia (set BENEFICIARY)
	$(SCRIPT) script/ops/CreateVault.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast --slow

# ---------------------------------------------------------------- deploy (mainnet, Phase 4 only)

deploy-base: ## Phase 4: shared contracts on Base mainnet (needs explicit approval)
	$(SCRIPT) script/DeployBase.s.sol --rpc-url $(BASE_RPC) --broadcast

deploy-rulebook-reactive: ## Phase 4: your Rulebook on Reactive mainnet (needs explicit approval)
	$(SCRIPT) script/DeployRulebook.s.sol --rpc-url $(REACTIVE_RPC) --broadcast

# ---------------------------------------------------------------- end-to-end testnet loops

e2e-hello: ## Phase 1: transfer on Base Sepolia -> Lasna -> callback; prints all three tx hashes
	cd contracts && bash script/e2e/hello.sh

e2e-hello-cron: ## Phase 1: observed cron ticks, interval and lREACT per tick
	cd contracts && bash script/e2e/hello-cron.sh

e2e-rule1: ## Phase 2: listed and unlisted income -> Lasna -> vault; prints all tx hashes
	cd contracts && bash script/e2e/rule1.sh

e2e-phase3: ## Phase 3: claim, Guardian clear (from Unichain) and Guardian release on one Rulebook; set BENEFICIARY
	cd contracts && bash script/e2e/phase3.sh

pay-test-usdc: ## Testnet demo: pay TO_ADDRESS some test USDC (PAY_AMOUNT, default 10) from this wallet, a listed sender
	cd contracts && forge script script/ops/PayTestUsdc.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast

# e2e-claim, e2e-guardian-clear and e2e-guardian-release run in sequence inside e2e-phase3 (one Rulebook, one vault).
e2e-claim e2e-guardian-clear e2e-guardian-release: e2e-phase3

# ---------------------------------------------------------------- your everyday actions (U-5)
# Base side (BASE_SEPOLIA_RPC; set NET=base for mainnet) and Reactive side (LASNA_RPC; NET=reactive for mainnet).

OPS := cd contracts && forge script script/ops/UserOps.s.sol --broadcast --tc
BASE_SIDE := $(if $(filter base,$(NET)),$(BASE_RPC),$(BASE_SEPOLIA_RPC))
REACTIVE_SIDE := $(if $(filter reactive,$(NET)),$(REACTIVE_RPC),$(LASNA_RPC))

alive: ## I'm alive (resets the Guardian clock)
	$(OPS) Alive --rpc-url $(BASE_SIDE)
pause: ## Pause every rule (withdraw still works)
	$(OPS) Pause --rpc-url $(BASE_SIDE)
unpause: ## Resume every rule
	$(OPS) Unpause --rpc-url $(BASE_SIDE)
withdraw: ## Withdraw from your vault (WITHDRAW_TOKEN, WITHDRAW_AMOUNT optional)
	$(OPS) Withdraw --rpc-url $(BASE_SIDE)
propose-beneficiary: ## Propose a new BENEFICIARY (applies after 24h)
	$(OPS) ProposeBeneficiary --rpc-url $(BASE_SIDE)
apply-beneficiary: ## Apply the proposed beneficiary
	$(OPS) ApplyBeneficiary --rpc-url $(BASE_SIDE)
propose-cold-wallet: ## Propose a COLD_WALLET for claims (applies after 24h)
	$(OPS) ProposeColdWallet --rpc-url $(BASE_SIDE)
apply-cold-wallet: ## Apply the proposed cold wallet
	$(OPS) ApplyColdWallet --rpc-url $(BASE_SIDE)
edit-rules: ## Change Rule 1 (SPLIT_BPS, PERIOD_CAP, INCOME_SENDERS) on your Rulebook
	$(OPS) EditRules --rpc-url $(REACTIVE_SIDE)
top-up-react: ## Send TOP_UP_WEI of REACT to your Rulebook and clear its debt
	$(OPS) TopUpReact --rpc-url $(REACTIVE_SIDE)
withdraw-react: ## Send the REACT left in your Rulebook back to you, after its debt (WITHDRAW_REACT_WEI optional)
	$(OPS) WithdrawReact --rpc-url $(REACTIVE_SIDE)
check-now: ## Advance the Guardian by timestamp if cron is late
	$(OPS) CheckNow --rpc-url $(REACTIVE_SIDE)
status: ## Print your Rulebook's Guardian state, clocks and REACT balance
	cd contracts && forge script script/ops/UserOps.s.sol --tc Status --rpc-url $(REACTIVE_SIDE)

# ---------------------------------------------------------------- web (Phase 5)
# On Windows, run these from a path with an upper-case drive letter (C:...), or Next.js may load React twice.

WEB := cd web && pnpm

web-install: ## Install the page's dependencies (pnpm)
	$(WEB) install --frozen-lockfile
web-sync: ## Copy Rulebook bytecode and deployments into web/lib/generated (after forge build or a deploy)
	$(WEB) sync
web-dev: ## Run the page at http://localhost:3000 (add ?preview=active|warning|released|paused|lowreact|novault)
	$(WEB) dev
web-check: ## Lint, typecheck, format check and unit tests for the page
	$(WEB) lint && $(WEB) typecheck && $(WEB) format:check && $(WEB) test
web-e2e: ## Build the page and run the Playwright smoke test
	$(WEB) build && $(WEB) test:e2e

# ---------------------------------------------------------------- evidence (Phase 7)

check-live: ## Re-check every recorded loop and the live mainnet vault from public RPCs (no keys; Node 18+)
	node scripts/check-live.mjs
