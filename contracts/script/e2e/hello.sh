#!/usr/bin/env bash
# Phase 1 end-to-end: send a MockUSDC transfer on Base Sepolia, then follow it through Lasna and back.
# Prints the origin, Reactive and callback tx hashes. Run from contracts/ (the Makefile does this):
#   make e2e-hello
# Needs: cast, forge, node; .env loaded (PRIVATE_KEY, BASE_SEPOLIA_RPC, LASNA_RPC).
set -euo pipefail

BASE_RPC="${BASE_SEPOLIA_RPC:?}"
LASNA="${LASNA_RPC:?}"
SYSTEM=0x8888888888888888888888888888888888888888
TIMEOUT="${HELLO_TIMEOUT_SECONDS:-600}"

json() { node -e "const j=JSON.parse(require('fs').readFileSync('$1','utf8'));console.log(j$2)"; }

RECEIVER=$(json deployments/hello-base-sepolia.json .helloReceiver)
REACTIVE=$(json deployments/hello-lasna.json .helloReactive)
FROM_BLOCK=$(json deployments/hello-lasna.json .deployBlock)

echo "HelloReceiver (Base Sepolia): $RECEIVER"
echo "HelloReactive (Lasna):        $REACTIVE"

# 1. Origin: mint + transfer on Base Sepolia. Set ORIGIN_TX to follow an earlier transfer instead of sending one.
if [ -z "${ORIGIN_TX:-}" ]; then
  forge script script/e2e/Hello.s.sol --rpc-url "$BASE_RPC" --broadcast --slow -q
  ORIGIN_TX=$(json broadcast/Hello.s.sol/84532/run-latest.json ".transactions[1].hash")
fi
ORIGIN_BLOCK_TS=$(cast block "$(cast receipt "$ORIGIN_TX" blockNumber --rpc-url "$BASE_RPC")" --field timestamp --rpc-url "$BASE_RPC")
echo "Origin tx (transfer):         $ORIGIN_TX"

# 2. Reactive: find HelloReactive's TransferSeen(originTxHash) log on Lasna.
SEEN_TOPIC=$(cast keccak "TransferSeen(uint256,address,address,uint256)")
REACTIVE_TX=""
START=$(date +%s)
while [ -z "$REACTIVE_TX" ]; do
  if [ $(( $(date +%s) - START )) -gt "$TIMEOUT" ]; then echo "TIMEOUT waiting for the Reactive tx"; exit 1; fi
  sleep 5
  REACTIVE_TX=$(cast logs --from-block "$FROM_BLOCK" --address "$REACTIVE" "$SEEN_TOPIC" "$ORIGIN_TX" \
    --rpc-url "$LASNA" --json 2>/dev/null | node -e "const l=JSON.parse(require('fs').readFileSync(0,'utf8')||'[]');console.log(l.length?l[0].transactionHash:'')" || true)
done
echo "Reactive tx (Lasna):          $REACTIVE_TX"

# 3. Callback: ask the system contract which destination tx delivered it.
CALLBACK_TX=""
while [ -z "$CALLBACK_TX" ]; do
  if [ $(( $(date +%s) - START )) -gt "$TIMEOUT" ]; then echo "TIMEOUT waiting for the callback tx"; exit 1; fi
  sleep 5
  RAW=$(cast call "$SYSTEM" "getCallbacks(uint256)((uint256,address,uint256,uint256,uint256,bytes)[])" "$REACTIVE_TX" \
    --rpc-url "$LASNA" 2>/dev/null || true)
  # Record: (blockNumber, sender, index, chainId, txHash, err). txHash is the 5th field, printed as a decimal.
  CALLBACK_TX=$(node -e "
    const m='$RAW'.match(/\(([^()]*)\)/); if(!m){console.log('');process.exit(0)}
    const f=m[1].split(',').map(s=>s.trim().split(' ')[0]);
    console.log('0x'+BigInt(f[4]).toString(16).padStart(64,'0'));")
done
echo "Callback tx (Base Sepolia):   $CALLBACK_TX"
echo "getCallbacks record:          $RAW"

# 4. Confirm the Pinged event and what the injected sender was.
CB_TS=$(cast block "$(cast receipt "$CALLBACK_TX" blockNumber --rpc-url "$BASE_RPC")" --field timestamp --rpc-url "$BASE_RPC")
echo "pingCount:                    $(cast call "$RECEIVER" "pingCount()(uint256)" --rpc-url "$BASE_RPC")"
echo "lastRvmId (injected sender):  $(cast call "$RECEIVER" "lastRvmId()(address)" --rpc-url "$BASE_RPC")"
echo "deployer wallet:              $(json deployments/hello-base-sepolia.json .deployer)"
echo "Latency origin -> callback:   $((CB_TS - ORIGIN_BLOCK_TS)) s (block timestamps)"
echo
echo "| Rule | Network | Origin tx | Reactive tx | Callback tx |"
echo "| --- | --- | --- | --- | --- |"
echo "| Hello loop | Base Sepolia -> Lasna -> Base Sepolia | $ORIGIN_TX | $REACTIVE_TX | $CALLBACK_TX |"
