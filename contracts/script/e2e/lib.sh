#!/usr/bin/env bash
# Shared helpers for the e2e runners. Source from contracts/:  . script/e2e/lib.sh
# Needs cast and node; .env loaded.

E2E_TIMEOUT="${E2E_TIMEOUT_SECONDS:-600}"

# json FILE .path   -> prints the value
json() { node -e "const j=JSON.parse(require('fs').readFileSync('$1','utf8'));console.log(j$2)"; }

# broadcast_tx SCRIPT CHAIN INDEX   -> tx hash of the INDEX-th receipt in the latest broadcast of SCRIPT
broadcast_tx() { json "broadcast/$1/$2/run-latest.json" ".receipts[$3].transactionHash"; }

# wait_lasna_log ADDRESS EVENT_SIG TOPIC1 FROM_BLOCK   -> tx hash of the first matching log on Lasna (polls)
wait_lasna_log() {
  local address=$1 topic0 topic1=$3 from=$4 start tx=""
  topic0=$(cast keccak "$2"); start=$(date +%s)
  while [ -z "$tx" ]; do
    if [ $(( $(date +%s) - start )) -gt "$E2E_TIMEOUT" ]; then echo "TIMEOUT"; return 1; fi
    tx=$(cast logs --from-block "$from" --address "$address" "$topic0" "$topic1" --rpc-url "$LASNA_RPC" --json 2>/dev/null \
      | node -e "const l=JSON.parse(require('fs').readFileSync(0,'utf8')||'[]');console.log(l.length?l[0].transactionHash:'')" || true)
    [ -z "$tx" ] && sleep 5
  done
  echo "$tx"
}

# wait_base_log RPC ADDRESS EVENT_SIG FROM_BLOCK [TOPIC1]   -> tx hash of the first matching log (polls in 200-block
# chunks, the public Base RPC limit)
wait_base_log() {
  local rpc=$1 address=$2 topic0 from=$4 topic1=${5:-} start tx="" head to
  topic0=$(cast keccak "$3"); start=$(date +%s)
  while [ -z "$tx" ]; do
    if [ $(( $(date +%s) - start )) -gt "$E2E_TIMEOUT" ]; then echo "TIMEOUT"; return 1; fi
    head=$(cast block-number --rpc-url "$rpc" 2>/dev/null || echo "$from")
    while [ -z "$tx" ] && [ "$from" -le "$head" ]; do
      to=$(( from + 199 < head ? from + 199 : head ))
      tx=$(cast logs --from-block "$from" --to-block "$to" --address "$address" "$topic0" $topic1 --rpc-url "$rpc" --json 2>/dev/null \
        | node -e "const l=JSON.parse(require('fs').readFileSync(0,'utf8')||'[]');console.log(l.length?l[0].transactionHash:'')" || true)
      [ -z "$tx" ] && from=$(( to + 1 ))
    done
    [ -z "$tx" ] && sleep 5
  done
  echo "$tx"
}

# topic ADDRESS -> the address as a 32-byte log topic (left-padded with zeros)
topic() { local a; a=$(echo "${1#0x}" | tr 'A-F' 'a-f'); printf '0x%064s\n' "$a" | tr ' ' '0'; }
