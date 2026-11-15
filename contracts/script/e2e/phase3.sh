#!/usr/bin/env bash
# Phase 3 end-to-end on Base Sepolia + Unichain Sepolia <-> Lasna, with demo timers, on ONE Rulebook and vault:
#   setup   vesting wallet -> Rulebook (Lasna, Cron10) -> vault (permit) -> one-time VEST approval
#   claim   cron claims vested VEST into the vault                         (Rule 2: C-1, C-2)
#   clear   silence -> GuardianWarning -> the user acts on Unichain -> GuardianCleared   (G-2, G-3, G-4)
#   release silence -> GuardianWarning -> grace -> release -> beneficiary receives the vault (G-2, V-2)
# Prints origin, Reactive and callback tx hashes for each. Run from contracts/:  make e2e-phase3
# Prereq: make deploy-base-sepolia (Phase 3 contracts). Env: BENEFICIARY (required).
set -euo pipefail
. script/e2e/lib.sh

BASE="${BASE_SEPOLIA_RPC:?}"; UNI="${UNICHAIN_SEPOLIA_RPC:?}"; : "${LASNA_RPC:?}"; : "${BENEFICIARY:?set BENEFICIARY}"
export E2E_TIMEOUT_SECONDS=900
SILENCE="${SILENCE_PERIOD:-180}"; GRACE="${GRACE_PERIOD:-120}"
EXECUTOR=$(json deployments/base-sepolia.json .ordersExecutor)
FACTORY=$(json deployments/base-sepolia.json .vaultFactory)
row() { printf '| %s | %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4" "$5" >> "$OUT"; }
OUT=$(mktemp); echo "| Rule | Network | Origin tx | Reactive tx | Callback tx |" > "$OUT"; echo "| --- | --- | --- | --- | --- |" >> "$OUT"
step() { echo; echo "== $(date -u +%H:%M:%S) $*"; }

# ------------------------------------------------------------------ setup
step "Vesting wallet on Base Sepolia"
forge script script/e2e/Phase3.s.sol --tc Phase3Vesting --rpc-url "$BASE" --broadcast --slow -q
VEST=$(json deployments/phase3-base-sepolia.json .vestToken)
VESTING=$(json deployments/phase3-base-sepolia.json .vestingWallet)
echo "VEST $VEST  vesting wallet $VESTING"

step "Rulebook on Lasna (Cron10, claim every ${CLAIM_INTERVAL:-90}s, silence ${SILENCE}s, grace ${GRACE}s, check 30s)"
VESTING="$VESTING" VESTING_TOKEN="$VEST" CLAIM_INTERVAL="${CLAIM_INTERVAL:-90}" \
  SILENCE_PERIOD="$SILENCE" GRACE_PERIOD="$GRACE" GUARDIAN_CHECK_INTERVAL=30 \
  RULEBOOK_CRON=0x04463f7c1651e6b9774d7f85c85bb94654e3c46ca79b0c16fb16d4183307b687 \
  RULEBOOK_FUNDING_WEI="${RULEBOOK_FUNDING_WEI:-2500000000000000000}" \
  forge script script/DeployRulebook.s.sol --rpc-url "$LASNA_RPC" --broadcast --slow -q
RULEBOOK=$(json deployments/rulebook-lasna.json .rulebook)
USER=$(json deployments/rulebook-lasna.json .user)
LASNA_FROM=$(json deployments/rulebook-lasna.json .deployBlock)
echo "Rulebook $RULEBOOK (user $USER)"

step "Vault on Base Sepolia (beneficiary $BENEFICIARY) and the one-time VEST approval"
BENEFICIARY="$BENEFICIARY" forge script script/ops/CreateVault.s.sol --rpc-url "$BASE" --broadcast --slow -q
forge script script/e2e/Phase3.s.sol --tc Phase3ApproveVesting --rpc-url "$BASE" --broadcast --slow -q
VAULT=$(cast call "$FACTORY" "vaultOf(address)(address)" "$USER" --rpc-url "$BASE")
BASE_FROM=$(cast block-number --rpc-url "$BASE")
echo "Vault $VAULT"

# ------------------------------------------------------------------ Rule 2: claim
step "Waiting for a cron claim (Rule 2)"
CLAIM_CB=$(wait_base_log "$BASE" "$EXECUTOR" "ClaimExecuted(address,address,address,uint256,bool,uint256)" "$BASE_FROM" "$(topic "$USER")")
CLAIM_RX=$(wait_lasna_log "$RULEBOOK" "ClaimRequested(address,address,uint256)" "$(topic "$VESTING")" "$LASNA_FROM")
echo "claim: reactive $CLAIM_RX  callback $CLAIM_CB"
echo "vault VEST: $(cast call "$VEST" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$BASE")"
row "Rule 2 claim (cron)" "Lasna cron -> Base Sepolia" "Cron10 tick (Lasna)" "$CLAIM_RX" "$CLAIM_CB"

# ------------------------------------------------------------------ Guardian: warning, then cleared from Unichain
step "Waiting for silence -> GuardianWarning (about $((SILENCE + 40))s)"
WARN1=$(wait_lasna_log "$RULEBOOK" "GuardianWarning(uint256,uint256)" "" "$LASNA_FROM")
echo "GuardianWarning: $WARN1"
WARN1_BLOCK=$(cast receipt "$WARN1" blockNumber --rpc-url "$LASNA_RPC")

step "User acts on Unichain Sepolia (second watched chain)"
forge script script/e2e/Phase3.s.sol --tc Phase3UnichainActivity --rpc-url "$UNI" --broadcast --slow -q
UNI_TX=$(broadcast_tx Phase3.s.sol 1301 2)
echo "Unichain transfer: $UNI_TX"
CLEAR=$(wait_lasna_log "$RULEBOOK" "GuardianCleared(uint256,uint256)" "$(printf '0x%064x' 1301)" "$WARN1_BLOCK")
echo "GuardianCleared: $CLEAR"
row "Guardian: Active -> Warning (silence)" "Lasna cron" "Cron10 tick (Lasna)" "$WARN1" "none"
row "Guardian: Warning -> Active (activity on Unichain)" "Unichain Sepolia -> Lasna" "$UNI_TX" "$CLEAR" "none"

# ------------------------------------------------------------------ Guardian: warning, grace, release
step "Silence again -> GuardianWarning -> grace -> release (about $((SILENCE + GRACE + 80))s)"
CLEAR_BLOCK=$(cast receipt "$CLEAR" blockNumber --rpc-url "$LASNA_RPC")
WARN2=$(wait_lasna_log "$RULEBOOK" "GuardianWarning(uint256,uint256)" "" "$CLEAR_BLOCK")
echo "GuardianWarning (2): $WARN2"
RELEASED=$(wait_lasna_log "$RULEBOOK" "GuardianReleased(uint256)" "" "$CLEAR_BLOCK")
echo "GuardianReleased: $RELEASED"
RELEASE_CB=$(wait_base_log "$BASE" "$EXECUTOR" "VaultReleased(address,address,uint256)" "$BASE_FROM" "$(topic "$USER")")
echo "VaultReleased: $RELEASE_CB"
row "Guardian: Active -> Warning (silence)" "Lasna cron" "Cron10 tick (Lasna)" "$WARN2" "none"
row "Guardian: Warning -> Released (grace passed)" "Lasna cron -> Base Sepolia" "Cron10 tick (Lasna)" "$RELEASED" "$RELEASE_CB"

echo
echo "Beneficiary VEST: $(cast call "$VEST" "balanceOf(address)(uint256)" "$BENEFICIARY" --rpc-url "$BASE")"
echo "Vault VEST left:  $(cast call "$VEST" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$BASE")"
echo "Rulebook state:   $(cast call "$RULEBOOK" "state()(uint8)" --rpc-url "$LASNA_RPC")  (2 = Released)"
echo
cat "$OUT"
