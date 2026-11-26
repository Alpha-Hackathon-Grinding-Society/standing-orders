#!/usr/bin/env bash
# Mainnet showcase: a second, small Steward vault on Base mainnet, owned by the wallet in PRIVATE_KEY, so Rule 2 and
# the Guardian's full cycle run on mainnet with real USDC, not only on testnet.
#
#   setup    VestingWallet (0.5 USDC over 3 h) -> Rulebook on Reactive mainnet -> vault on Base (1 USDC permit)
#   claim    every hour, cron claims what has vested into the vault                        (Rule 2)
#   guardian 4 h with no signed activity -> GuardianWarning -> 1 h grace -> release to BENEFICIARY
#
# The vault's money ends with BENEFICIARY. Nothing here signs again after setup: the wallet must stay silent on Base
# and Arbitrum for about 5 hours, or the Guardian (correctly) clears.
#
# Needs: STEWARD_MAINNET_APPROVED=true, BENEFICIARY, and in the wallet ≥ VESTING_AMOUNT USDC and a little ETH on Base,
# ≥ SHOWCASE_FUNDING_WEI + ~1 REACT on Reactive. Run from contracts/:  bash script/e2e/showcase.sh
set -euo pipefail
. script/e2e/lib.sh

: "${BENEFICIARY:?set BENEFICIARY, the address that receives the vault at the end}"
[ "${STEWARD_MAINNET_APPROVED:-}" = "true" ] || { echo "mainnet needs STEWARD_MAINNET_APPROVED=true"; exit 1; }

USDC=$(json deployments/base.json .usdc)
FUNDING="${SHOWCASE_FUNDING_WEI:-5000000000000000000}"   # 5 REACT for the Rulebook; the rest comes back with withdrawReact
USER=$(cast wallet address --private-key "$PRIVATE_KEY")
step() { echo; echo "== $(date -u +%H:%M:%S) UTC  $*"; }

step "Wallet $USER"
echo "Base ETH  $(cast balance "$USER" --ether --rpc-url "$BASE_RPC")"
echo "Base USDC $(cast call "$USDC" "balanceOf(address)(uint256)" "$USER" --rpc-url "$BASE_RPC")"
echo "REACT     $(cast balance "$USER" --ether --rpc-url "$REACTIVE_RPC")"

step "1/3 VestingWallet on Base: ${VESTING_AMOUNT:-500000} USDC units over ${VESTING_DURATION:-10800} s"
forge script script/e2e/Showcase.s.sol --tc ShowcaseVesting --rpc-url "$BASE_RPC" --broadcast --slow -q
VESTING=$(json deployments/showcase-base.json .vesting)
VEST_TX0=$(broadcast_tx Showcase.s.sol 8453 0)
VEST_TX1=$(broadcast_tx Showcase.s.sol 8453 1)

step "2/3 Rulebook on Reactive mainnet (claim hourly, silence 4 h, grace 1 h, checked every 15 min, Cron1000)"
VESTING="$VESTING" VESTING_TOKEN="$USDC" CLAIM_INTERVAL=3600 \
  SILENCE_PERIOD=14400 GRACE_PERIOD=3600 GUARDIAN_CHECK_INTERVAL=900 \
  INCOME_SENDERS="$BENEFICIARY" SPLIT_BPS=2000 PERIOD_CAP=1000000 \
  RULEBOOK_FUNDING_WEI="$FUNDING" RULEBOOK_OUT=showcase-reactive \
  forge script script/DeployRulebook.s.sol --rpc-url "$REACTIVE_RPC" --broadcast --slow -q
RULEBOOK=$(json deployments/showcase-reactive.json .rulebook)
RB_TX=$(broadcast_tx DeployRulebook.s.sol 1597 0)

step "3/3 Vault on Base: permit 1 USDC for the executor (claims), beneficiary $BENEFICIARY"
RULEBOOK_FILE=showcase-reactive PERMIT_CAP=1000000 BENEFICIARY="$BENEFICIARY" \
  forge script script/ops/CreateVault.s.sol --rpc-url "$BASE_RPC" --broadcast --slow -q
VAULT=$(json deployments/showcase-reactive.json .vault)
VAULT_TX=$(broadcast_tx CreateVault.s.sol 8453 0)

step "Set up. Add these to docs/TX_HASHES.md; the loops follow on their own."
printf '%-28s %s\n' "VestingWallet" "$VESTING" "Rulebook (Reactive)" "$RULEBOOK" "Vault (Base)" "$VAULT"
printf '%-28s %s\n' "VestingWallet deploy" "https://basescan.org/tx/$VEST_TX0" "USDC into vesting" "https://basescan.org/tx/$VEST_TX1" \
  "Rulebook deploy" "https://reactscan.net/tx/$RB_TX" "Permit + createVault" "https://basescan.org/tx/$VAULT_TX"
echo
echo "Expect: ClaimRequested about hourly; GuardianWarning about 4 h after setup (+ up to 30 min for cron and the"
echo "check interval); GuardianReleased about 1 h after that. Watch: https://reactscan.net/address/$RULEBOOK"
echo "Afterwards: RULEBOOK=$RULEBOOK make withdraw-react NET=reactive brings the unspent REACT back."
