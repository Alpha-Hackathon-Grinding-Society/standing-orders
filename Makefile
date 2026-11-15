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
	e2e-hello e2e-hello-cron e2e-rule1 e2e-claim e2e-guardian-clear e2e-guardian-release

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

e2e-claim: ## Phase 3: cron claim of vested tokens
	$(SCRIPT) script/e2e/Claim.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast

e2e-guardian-clear: ## Phase 3: silence -> Warning -> activity -> Active
	$(SCRIPT) script/e2e/GuardianClear.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast

e2e-guardian-release: ## Phase 3: silence -> Warning -> grace -> beneficiary
	$(SCRIPT) script/e2e/GuardianRelease.s.sol --rpc-url $(BASE_SEPOLIA_RPC) --broadcast
