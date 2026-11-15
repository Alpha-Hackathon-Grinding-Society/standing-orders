#!/usr/bin/env bash
# Phase 2 end-to-end: Rule 1 on Base Sepolia <-> Lasna.
#   1. two test employers (one listed, one not)      [skipped if already deployed]
#   2. the user's Rulebook on Lasna                    [skipped if already deployed]
#   3. the user's vault on Base Sepolia                [skipped if the wallet already has one]
#   4. both employers pay the user 100 USDC
#   5. follow both payments through Lasna; the listed one must reach the vault, the unlisted one must not
# Prints origin, Reactive and callback tx hashes. Run from contracts/:  make e2e-rule1
# Prereq: make deploy-base-sepolia.  Env: BENEFICIARY [0x...bEEF], RULE1_SETTLE_SECONDS [60].
set -euo pipefail
. script/e2e/lib.sh

BASE="${BASE_SEPOLIA_RPC:?}"
: "${LASNA_RPC:?}"
[ -f deployments/base-sepolia.json ] || { echo "Run make deploy-base-sepolia first"; exit 1; }

FACTORY=$(json deployments/base-sepolia.json .vaultFactory)
EXECUTOR=$(json deployments/base-sepolia.json .ordersExecutor)
USDC=$(json deployments/base-sepolia.json .usdc)

# 1. Employers.
if [ ! -f deployments/rule1-payers-base-sepolia.json ]; then
  forge script script/e2e/Rule1Payers.s.sol --rpc-url "$BASE" --broadcast --slow -q
fi
LISTED=$(json deployments/rule1-payers-base-sepolia.json .listed)
UNLISTED=$(json deployments/rule1-payers-base-sepolia.json .unlisted)

# 2. Rulebook on Lasna, listing only the first employer.
if [ ! -f deployments/rulebook-lasna.json ]; then
  INCOME_SENDERS="$LISTED" forge script script/DeployRulebook.s.sol --rpc-url "$LASNA_RPC" --broadcast --slow -q
fi
RULEBOOK=$(json deployments/rulebook-lasna.json .rulebook)
USER=$(json deployments/rulebook-lasna.json .user)
LASNA_FROM=$(json deployments/rulebook-lasna.json .deployBlock)

# 3. Vault on Base Sepolia, registering that Rulebook.
VAULT=$(cast call "$FACTORY" "vaultOf(address)(address)" "$USER" --rpc-url "$BASE")
if [ "$VAULT" = "0x0000000000000000000000000000000000000000" ]; then
  BENEFICIARY="${BENEFICIARY:-0x000000000000000000000000000000000000bEEF}" \
    forge script script/ops/CreateVault.s.sol --rpc-url "$BASE" --broadcast --slow -q
  VAULT=$(cast call "$FACTORY" "vaultOf(address)(address)" "$USER" --rpc-url "$BASE")
fi
echo "User:          $USER"
echo "Rulebook:      $RULEBOOK (Lasna)"
echo "Vault:         $VAULT"
echo "Executor:      $EXECUTOR"
echo "Listed payer:  $LISTED"
echo "Unlisted payer:$UNLISTED"

VAULT_BEFORE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$BASE" | cut -d' ' -f1)
SPLIT_BPS=$(cast call "$RULEBOOK" "splitBps()(uint16)" --rpc-url "$LASNA_RPC")

# 4. Both employers pay 100 USDC.
forge script script/e2e/Rule1.s.sol --rpc-url "$BASE" --broadcast --slow -q
ORIGIN_LISTED=$(broadcast_tx Rule1.s.sol 84532 0)
ORIGIN_UNLISTED=$(broadcast_tx Rule1.s.sol 84532 1)
ORIGIN_BLOCK=$(cast receipt "$ORIGIN_LISTED" blockNumber --rpc-url "$BASE")
echo "Origin (listed):    $ORIGIN_LISTED"
echo "Origin (unlisted):  $ORIGIN_UNLISTED"

# 5. Follow them.
REACTIVE_LISTED=$(wait_lasna_log "$RULEBOOK" "SplitRequested(uint256,address,uint256,uint256,uint256)" "$ORIGIN_LISTED" "$LASNA_FROM")
echo "Reactive (listed):  $REACTIVE_LISTED   SplitRequested"
REACTIVE_UNLISTED=$(wait_lasna_log "$RULEBOOK" "IncomeIgnored(uint256,address,uint256)" "$ORIGIN_UNLISTED" "$LASNA_FROM")
echo "Reactive (unlisted): $REACTIVE_UNLISTED  IncomeIgnored"
CALLBACK=$(wait_base_log "$BASE" "$EXECUTOR" "SplitExecuted(address,address,uint256,uint256)" "$ORIGIN_BLOCK" "$(topic "$USER")")
echo "Callback (listed):  $CALLBACK   SplitExecuted"

# Give any (wrong) second callback time to land before checking the balance.
sleep "${RULE1_SETTLE_SECONDS:-60}"
VAULT_AFTER=$(cast call "$USDC" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$BASE" | cut -d' ' -f1)
EXPECTED=$(( 100000000 * SPLIT_BPS / 10000 ))
echo
echo "Vault USDC before: $VAULT_BEFORE  after: $VAULT_AFTER  (expected +$EXPECTED, the listed payment's ${SPLIT_BPS} bps)"
if [ $(( VAULT_AFTER - VAULT_BEFORE )) -ne "$EXPECTED" ]; then echo "FAIL: vault did not receive exactly the listed share"; exit 1; fi
echo "PASS: listed payment split into the vault; unlisted payment produced no split"
echo
echo "| Rule | Network | Origin tx | Reactive tx | Callback tx |"
echo "| --- | --- | --- | --- | --- |"
echo "| Rule 1 split (listed sender) | Base Sepolia -> Lasna -> Base Sepolia | $ORIGIN_LISTED | $REACTIVE_LISTED | $CALLBACK |"
echo "| Rule 1 ignored (unlisted sender) | Base Sepolia -> Lasna | $ORIGIN_UNLISTED | $REACTIVE_UNLISTED | none (by design) |"
