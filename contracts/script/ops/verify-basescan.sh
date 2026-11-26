#!/usr/bin/env bash
# Verifies Steward's Base mainnet contracts on Basescan (Etherscan API v2). The same contracts are already exact
# matches on Sourcify (docs/NOTES.md §16); this adds the source to Basescan's own Contract tab.
#
# Needs BASESCAN_API_KEY in .env: a free key from etherscan.io (one v2 key covers Base). The key is passed through
# the environment only and never printed. Run from contracts/:  bash script/ops/verify-basescan.sh
set -euo pipefail
: "${BASESCAN_API_KEY:?add BASESCAN_API_KEY to .env (a free key from etherscan.io)}"
export ETHERSCAN_API_KEY="$BASESCAN_API_KEY"

json() { node -e "const j=JSON.parse(require('fs').readFileSync('$1','utf8'));console.log(j$2)"; }
PROXY=$(json deployments/base.json .callbackProxy)
EXECUTOR=$(json deployments/base.json .ordersExecutor)
USER=$(json deployments/rulebook-reactive.json .user)
VAULT=$(json deployments/rulebook-reactive.json .vault)

verify() { # ADDRESS CONTRACT [CONSTRUCTOR_ARGS]
  echo "== $2 $1"
  forge verify-contract "$1" "$2" --chain 8453 --verifier etherscan --watch ${3:+--constructor-args "$3"} || true
}

verify "$(json deployments/base.json .vaultFactory)" src/VaultFactory.sol:VaultFactory "$(cast abi-encode 'f(address)' "$PROXY")"
verify "$EXECUTOR" src/OrdersExecutor.sol:OrdersExecutor "$(cast abi-encode 'f(address)' "$PROXY")"
verify "$(json deployments/base.json .heartbeat)" src/Heartbeat.sol:Heartbeat
verify "$VAULT" src/SavingsVault.sol:SavingsVault "$(cast abi-encode 'f(address,address)' "$USER" "$EXECUTOR")"
