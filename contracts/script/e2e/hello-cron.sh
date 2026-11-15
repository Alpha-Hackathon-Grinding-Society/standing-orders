#!/usr/bin/env bash
# Phase 1 cron measurement: lists HelloReactive's Tick events on Lasna, the observed interval between ticks, and the
# lREACT charged per tick (from each reactive tx's gas, using the system contract's live fee parameters).
# Run from contracts/:  make e2e-hello-cron
set -euo pipefail

LASNA="${LASNA_RPC:?}"
SYSTEM=0x8888888888888888888888888888888888888888
json() { node -e "const j=JSON.parse(require('fs').readFileSync('$1','utf8'));console.log(j$2)"; }

REACTIVE=$(json deployments/hello-lasna.json .helloReactive)
FROM_BLOCK=$(json deployments/hello-lasna.json .deployBlock)
TICK_TOPIC=$(cast keccak "Tick(uint256,uint256,uint256)")
EXTRA_GAS=$(cast call "$SYSTEM" "_extraGas()(uint256)" --rpc-url "$LASNA" | cut -d' ' -f1)
COEFF=$(cast call "$SYSTEM" "_gasPriceCoeffPer1000()(uint256)" --rpc-url "$LASNA" | cut -d' ' -f1)

LOGS=$(cast logs --from-block "$FROM_BLOCK" --address "$REACTIVE" "$TICK_TOPIC" --rpc-url "$LASNA" --json)
echo "$LOGS" | EXTRA_GAS="$EXTRA_GAS" COEFF="$COEFF" LASNA="$LASNA" node -e '
const {execSync}=require("child_process");
const logs=JSON.parse(require("fs").readFileSync(0,"utf8")||"[]");
const extra=BigInt(process.env.EXTRA_GAS), coeff=BigInt(process.env.COEFF);
console.log("| # | Lasna block | Timestamp (UTC) | Interval (s) | Gas used | Charged (lREACT) | Reactive tx |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
let prev=null, sumI=0, nI=0, sumFee=0n;
for (const l of logs) {
  const d=l.data.slice(2), ts=Number(BigInt("0x"+d.slice(0,64))), bn=Number(BigInt("0x"+d.slice(64,128))), n=Number(BigInt("0x"+d.slice(128,192)));
  const r=JSON.parse(execSync(`cast receipt ${l.transactionHash} --json --rpc-url ${process.env.LASNA}`).toString());
  const gas=BigInt(r.gasUsed), price=BigInt(r.effectiveGasPrice);
  const fee=price*coeff/1000n*(gas+extra); sumFee+=fee;
  const iv = prev===null ? "" : String(ts-prev); if(prev!==null){sumI+=ts-prev;nI++} prev=ts;
  console.log(`| ${n} | ${bn} | ${new Date(ts*1000).toISOString()} | ${iv} | ${gas} | ${(Number(fee)/1e18).toFixed(5)} | ${l.transactionHash} |`);
}
if (logs.length) {
  const avgFee=Number(sumFee)/logs.length/1e18;
  console.log(`\nTicks: ${logs.length}; mean interval ${nI? (sumI/nI).toFixed(1):"n/a"} s; mean charge ${avgFee.toFixed(5)} lREACT/tick`);
  if (nI) console.log(`Projected cost of this cron: ${(avgFee*86400/(sumI/nI)).toFixed(1)} lREACT/day`);
}'
echo
echo "HelloReactive balance: $(cast balance "$REACTIVE" --ether --rpc-url "$LASNA") lREACT"
echo "HelloReactive debt:    $(cast call "$SYSTEM" "debt(address)(uint256)" "$REACTIVE" --rpc-url "$LASNA")"
echo "cronActive:            $(cast call "$REACTIVE" "cronActive()(bool)" --rpc-url "$LASNA")"
