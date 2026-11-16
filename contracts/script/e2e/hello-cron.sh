#!/usr/bin/env bash
# Phase 1 cron measurement: lists HelloReactive's Tick events on Lasna, the observed interval between ticks, and the
# lREACT charged per tick. Reactive txs carry a zero gas price; the network debits the contract in the same block,
# so the charge is the contract's balance drop across the tick's block (needs an RPC that serves historical balances).
# Run from contracts/:  make e2e-hello-cron
set -euo pipefail

LASNA="${LASNA_RPC:?}"
SYSTEM=0x8888888888888888888888888888888888888888
json() { node -e "const j=JSON.parse(require('fs').readFileSync('$1','utf8'));console.log(j$2)"; }

REACTIVE=$(json deployments/hello-lasna.json .helloReactive)
FROM_BLOCK=$(json deployments/hello-lasna.json .deployBlock)
TICK_TOPIC=$(cast keccak "Tick(uint256,uint256,uint256)")

LOGS=$(cast logs --from-block "$FROM_BLOCK" --address "$REACTIVE" "$TICK_TOPIC" --rpc-url "$LASNA" --json)
echo "$LOGS" | REACTIVE="$REACTIVE" LASNA="$LASNA" node -e '
const {execSync}=require("child_process");
const logs=JSON.parse(require("fs").readFileSync(0,"utf8")||"[]");
const bal=b=>BigInt(execSync(`cast balance ${process.env.REACTIVE} --block ${b} --rpc-url ${process.env.LASNA}`).toString().trim());
console.log("| # | Lasna block | Timestamp (UTC) | Interval (s) | Charged (lREACT) | Reactive tx |");
console.log("| --- | --- | --- | --- | --- | --- |");
let prev=null, sumI=0, nI=0, sumFee=0n;
for (const l of logs) {
  const d=l.data.slice(2), ts=Number(BigInt("0x"+d.slice(0,64))), bn=Number(BigInt("0x"+d.slice(64,128))), n=Number(BigInt("0x"+d.slice(128,192)));
  const fee=bal(bn-1)-bal(bn); sumFee+=fee;
  const iv = prev===null ? "" : String(ts-prev); if(prev!==null){sumI+=ts-prev;nI++} prev=ts;
  console.log(`| ${n} | ${bn} | ${new Date(ts*1000).toISOString()} | ${iv} | ${(Number(fee)/1e18).toFixed(7)} | ${l.transactionHash} |`);
}
if (logs.length) {
  const avgFee=Number(sumFee)/logs.length/1e18;
  console.log(`\nTicks: ${logs.length}; mean interval ${nI? (sumI/nI).toFixed(1):"n/a"} s; mean charge ${avgFee.toFixed(7)} lREACT/tick`);
  if (nI) console.log(`Projected cost of this cron: ${(avgFee*86400/(sumI/nI)).toFixed(1)} lREACT/day`);
}'
echo
echo "HelloReactive balance: $(cast balance "$REACTIVE" --ether --rpc-url "$LASNA") lREACT"
echo "HelloReactive debt:    $(cast call "$SYSTEM" "debt(address)(uint256)" "$REACTIVE" --rpc-url "$LASNA")"
echo "cronActive:            $(cast call "$REACTIVE" "cronActive()(bool)" --rpc-url "$LASNA")"
