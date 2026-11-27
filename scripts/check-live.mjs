#!/usr/bin/env node
// Checks Steward's on-chain evidence from public RPCs. No keys, no wallet, no install: Node 18 or later.
//
//   node scripts/check-live.mjs             every recorded loop, then the live mainnet vault
//   node scripts/check-live.mjs --mainnet   mainnet only
//   node scripts/check-live.mjs --testnet   testnet only
//
// For each loop in scripts/evidence.json it fetches the receipts and checks that:
//   - every transaction succeeded;
//   - the Reactive transaction carries the Rulebook's event, and that event names the origin transaction it reacted to;
//   - the callback arrived through Reactive's callback proxy and carries the executor's event with the same nonce.
// Then it prints the time between the steps, and reads the mainnet vault and Rulebook as they are right now.
// Exits with 1 if any check fails.

import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync(new URL("./evidence.json", import.meta.url), "utf8"));
const only = process.argv.includes("--mainnet") ? "mainnet" : process.argv.includes("--testnet") ? "testnet" : null;

// Reactive's callback proxy on each destination chain (docs/NOTES.md §9).
const CALLBACK_PROXY = {
  base: "0xcc780dde33f56f55de778d42c930959374a4a068",
  "base-sepolia": "0x476f44b11f5c942c58f4c8e3d0300e5710743585",
};
const SYSTEM_CONTRACT = "0x8888888888888888888888888888888888888888";

// Event topics, from `cast keccak "<signature>"`.
const RULEBOOK_EVENTS = {
  "0x04167aae34ebf3beeb84b6dd4d7db89bf6648f797e0d4607625649c8220175b9": { name: "SplitRequested", originTopic: 1, nonceWord: 2 },
  "0xb9272a3f44b591fa7710046073ce8b8fa06aefe7e81c11ea230300c9bb14880b": { name: "IncomeIgnored", originTopic: 1 },
  "0x15d96425c87b88cab4760bb6cbdbfceca228d567bc444143d106ae197c247fd3": { name: "ActivityRecorded", originTopic: 2 },
  "0x6b2af0b99c0e5c8833c5d03f0f41f65e6d23ce413628bedb815b6e4eb0e113b5": { name: "GuardianCleared", originTopic: 2 },
  "0xcbb4b1f1516c93cd22e468e5c1e62e3022db93deef6fa69910e1871cc27bc20f": { name: "GuardianWarning" },
  "0xda1d8a74df2599fc94e4bae950f962dd7af7120f6a8c1a54f5881059fa033501": { name: "GuardianReleased", nonceWord: 0 },
  "0x4937cce2b75e8534dd1b00c796a7527bad00a7993dfb8232adeef9166906da0d": { name: "ClaimRequested", nonceWord: 0 },
  "0x7de7633587760f7cb6281a90943c5e7d0818ec69adc1e095de9819e0d84bf9b5": { name: "RulesEdited" },
  "0x4711e52c972094536a2b69a08c2257ab02b644f374a725bbccd324122bd7f124": { name: "PeriodReset" },
};
// Each executor event, and the Rulebook event that asked for it. A claim names its token, which is not always USDC.
const EXECUTOR_EVENTS = {
  "0xf2b20f1d7cb2d3fadf28da3ccc0aea04622e359e548c86498bcc436a9c39305d": { name: "SplitExecuted", asked: "SplitRequested", amountWord: 0, nonceWord: 1 },
  "0x44b391891e9ae1872a6e4bb1c307ae0b438a71fdce676f96d6ff93b6a8ed7014": { name: "ClaimExecuted", asked: "ClaimRequested", amountWord: 0, nonceWord: 2, tokenTopic: 3 },
  "0xd71cde0528fc779a44984e9a7320ea1d7f9c0c1cc1795e3bb1f09e2ab13f2468": { name: "VaultReleased", asked: "GuardianReleased", nonceWord: 0 },
};
// The system contract's log when a reactive contract queues a callback: topics are (chain id, sender, target).
const CALLBACK_QUEUED = "0xef94dbc611c4b95bf4b8ba34b413972180c2faf26fbb480befacedd83e07b133";

// ------------------------------------------------------------------ RPC

let rpcId = 0;
async function rpc(chain, method, params) {
  const { rpcs } = evidence.chains[chain];
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of rpcs) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
          signal: AbortSignal.timeout(20_000),
        });
        const body = await res.json();
        if (body.error) throw new Error(body.error.message);
        return body.result;
      } catch (e) {
        lastError = e;
      }
    }
    await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
  }
  throw new Error(`${evidence.chains[chain].name} ${method}: ${lastError?.message}`);
}

const word = (data, i) => BigInt("0x" + data.slice(2 + 64 * i, 2 + 64 * (i + 1)));
const call = async (chain, to, data) => rpc(chain, "eth_call", [{ to, data }, "latest"]);
const callUint = async (chain, to, data) => BigInt(await call(chain, to, data));
const pad = (address) => address.toLowerCase().replace("0x", "").padStart(64, "0");

async function receipt(chain, tx) {
  const r = await rpc(chain, "eth_getTransactionReceipt", [tx]);
  if (!r) throw new Error(`${tx} not found on ${evidence.chains[chain].name}`);
  const block = await rpc(chain, "eth_getBlockByNumber", [r.blockNumber, false]);
  return { ...r, timestamp: Number(block.timestamp) };
}

// ------------------------------------------------------------------ output

let failures = 0;
const results = [];
function check(ok, text) {
  if (!ok) failures++;
  results.push(`    ${ok ? "ok  " : "FAIL"} ${text}`);
}
const units = (v, decimals) => (Number(v) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 6 });
const usdc = (v) => units(v, 6);
const ether = (v) => (Number(v) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 });
const short = (h) => `${h.slice(0, 10)}…${h.slice(-4)}`;
const link = (step) => `${evidence.chains[step.chain].explorer}/tx/${step.tx}`;
const ago = (seconds) => {
  if (seconds < 120) return `${seconds} s`;
  if (seconds < 7_200) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172_800) return `${(seconds / 3_600).toFixed(1)} h`;
  return `${(seconds / 86_400).toFixed(1)} days`;
};

// ------------------------------------------------------------------ one loop

async function checkLoop(loop) {
  results.length = 0;
  const steps = {};
  for (const key of ["origin", "reactive", "callback"]) {
    if (!loop[key]) continue;
    steps[key] = await receipt(loop[key].chain, loop[key].tx);
    check(steps[key].status === "0x1", `${key.padEnd(8)} ${short(loop[key].tx)} succeeded  ${link(loop[key])}`);
  }

  // The Rulebook's own event in the Reactive transaction, and the origin it names. One cron tick can emit several
  // (a claim and a release), so a loop with a callback looks for the event that asked for that callback.
  const executorLog = loop.callback && steps.callback.logs.find((l) => EXECUTOR_EVENTS[l.topics[0]]);
  const done = executorLog && EXECUTOR_EVENTS[executorLog.topics[0]];
  const rulebookLogs = steps.reactive.logs.filter((l) => RULEBOOK_EVENTS[l.topics[0]]);
  const rulebookLog = rulebookLogs.find((l) => RULEBOOK_EVENTS[l.topics[0]].name === done?.asked) ?? rulebookLogs[0];
  const event = rulebookLog && RULEBOOK_EVENTS[rulebookLog.topics[0]];
  check(Boolean(event), `Reactive tx emits ${event ? event.name : "no Rulebook event"}${rulebookLog ? ` from ${rulebookLog.address}` : ""}`);
  let origin = loop.origin?.tx;
  if (event?.originTopic !== undefined) {
    const named = rulebookLog.topics[event.originTopic];
    if (origin) check(named === origin.toLowerCase(), `${event.name} names the origin tx ${short(named)}`);
    else results.push(`    info ${event.name} names origin tx ${short(named)}`);
    origin ??= named;
  } else if (!loop.origin) {
    results.push("    info triggered by a cron tick (no origin transaction)");
  }

  let amount = null;
  if (loop.callback) {
    const queued = steps.reactive.logs.find((l) => l.address.toLowerCase() === SYSTEM_CONTRACT && l.topics[0] === CALLBACK_QUEUED);
    const target = queued && "0x" + queued.topics[3].slice(26);
    check(Boolean(queued), `Reactive tx queues a callback to chain ${queued ? Number(queued.topics[1]) : "?"} → ${target ?? "?"}`);

    check(
      steps.callback.to?.toLowerCase() === CALLBACK_PROXY[loop.callback.chain],
      `callback delivered by Reactive's callback proxy ${steps.callback.to}`,
    );
    check(Boolean(done) && (!target || executorLog.address.toLowerCase() === target), `callback tx emits ${done ? done.name : "no executor event"} from the queued target`);
    if (done && event?.nonceWord !== undefined) {
      const asked = word(rulebookLog.data, event.nonceWord);
      const carried = word(executorLog.data, done.nonceWord);
      check(asked === carried, `nonce ${asked} requested on Reactive = nonce ${carried} executed`);
    }
    if (done?.amountWord !== undefined) {
      const token = done.tokenTopic ? "0x" + executorLog.topics[done.tokenTopic].slice(26) : null;
      const decimals = token ? Number(await callUint(loop.callback.chain, token, "0x313ce567")) : 6;
      amount = `${units(word(executorLog.data, done.amountWord), decimals)} ${token ? "vested tokens" : "USDC"}`;
    }
  }

  const t = (k) => steps[k]?.timestamp;
  const timing = {
    toReactive: t("origin") && t("reactive") ? t("reactive") - t("origin") : null,
    toCallback: t("reactive") && t("callback") ? t("callback") - t("reactive") : null,
  };
  timing.total = t("origin") && t("callback") ? t("callback") - t("origin") : null;
  // Where the payment and its callback land on the same chain, the block count is finer than the timestamps.
  timing.blocks =
    loop.origin && loop.callback && loop.origin.chain === loop.callback.chain
      ? { count: Number(steps.callback.blockNumber) - Number(steps.origin.blockNumber), chain: loop.origin.chain }
      : null;
  return { lines: [...results], timing, amount, origin, when: t("origin") ?? t("reactive") };
}

// ------------------------------------------------------------------ live mainnet vault

// Reactive's public RPC answers eth_getLogs for at most ~25,000 blocks (measured 2026-11-27), so the Rulebook's
// history since its deploy block is read in 20,000-block windows, five at a time.
async function rulebookLogs(address, fromBlock) {
  const WINDOW = 20_000;
  const head = Number(await rpc("reactive", "eth_blockNumber", []));
  const windows = [];
  for (let from = fromBlock; from <= head; from += WINDOW) windows.push([from, Math.min(from + WINDOW - 1, head)]);
  const logs = [];
  for (let i = 0; i < windows.length; i += 5) {
    const batch = windows.slice(i, i + 5).map(([from, to]) =>
      rpc("reactive", "eth_getLogs", [{ address, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }]),
    );
    for (const part of await Promise.all(batch)) logs.push(...part);
  }
  return logs;
}

async function liveMainnet() {
  const m = evidence.mainnet;
  const now = Math.floor(Date.now() / 1000);
  const lines = [];
  const vaultUsdc = await callUint("base", m.usdc, "0x70a08231" + pad(m.vault));
  const allowance = await callUint("base", m.usdc, "0xdd62ed3e" + pad(m.user) + pad(m.executor));
  const float = BigInt(await rpc("base", "eth_getBalance", [m.executor, "latest"]));
  const [state, lastActiveAny, splitThisPeriod, silence, grace] = await Promise.all(
    ["0xc19d93fb", "0x06e4ae2f", "0xa5d65db6", "0x3cae09ac", "0xa06db7dc"].map((sel) => callUint("reactive", m.rulebook, sel)),
  );
  const react = BigInt(await rpc("reactive", "eth_getBalance", [m.rulebook, "latest"]));
  const debt = await callUint("reactive", SYSTEM_CONTRACT, "0x9b6c56ec" + pad(m.rulebook));
  const logs = await rulebookLogs(m.rulebook, m.rulebookDeployBlock);

  const counts = {};
  let requested = 0n;
  for (const l of logs) {
    const e = RULEBOOK_EVENTS[l.topics[0]];
    const name = e ? e.name : l.topics[0].slice(0, 10);
    counts[name] = (counts[name] ?? 0) + 1;
    if (e?.name === "SplitRequested") requested += word(l.data, 1);
  }
  const states = ["Active", "Warning", "Released"];
  const running = now - Math.floor(Date.parse(m.runningSince) / 1000);

  lines.push(`  Running for        ${ago(running)} (since ${m.runningSince.replace("T", " ").replace(":00Z", " UTC")})`);
  lines.push(`  Vault balance      ${usdc(vaultUsdc)} USDC   (${m.vault} on Base)`);
  lines.push(`  Saved by Rule 1    ${usdc(requested)} USDC in ${counts.SplitRequested ?? 0} splits`);
  lines.push(`  Permit left        ${usdc(allowance)} USDC the executor may still move`);
  lines.push(`  Guardian           ${states[Number(state)] ?? `state ${state}`}, last activity ${ago(now - Number(lastActiveAny))} ago` +
    ` (warns after ${ago(Number(silence))} of silence, releases ${ago(Number(grace))} later)`);
  lines.push(`  This period        ${usdc(splitThisPeriod)} USDC split so far`);
  lines.push(`  Rulebook REACT     ${ether(react)} REACT, debt ${ether(debt)}   (${m.rulebook} on Reactive)`);
  lines.push(`  Executor float     ${ether(float)} ETH for callbacks`);
  lines.push(`  Rulebook events    ${Object.entries(counts).map(([k, v]) => `${k} ×${v}`).join(", ")}`);
  check(Number(state) === 0, "Guardian is Active");
  check(debt === 0n, "Rulebook has no REACT debt");
  return lines;
}

// ------------------------------------------------------------------ run

const timings = [];
for (const net of ["mainnet", "testnet"]) {
  if (only && only !== net) continue;
  console.log(`\n== ${net === "mainnet" ? "Mainnet: Base and Arbitrum ↔ Reactive (1597)" : "Testnet: Base Sepolia and Unichain Sepolia ↔ Lasna"}`);
  for (const loop of evidence.loops.filter((l) => l.net === net)) {
    try {
      const r = await checkLoop(loop);
      const when = new Date(r.when * 1000).toISOString().replace("T", " ").slice(0, 16);
      console.log(`\n  ${loop.rule}  (${when} UTC${r.amount ? `, ${r.amount} moved` : ""})`);
      console.log(r.lines.join("\n"));
      timings.push({ net, rule: loop.rule, ...r.timing });
    } catch (e) {
      failures++;
      console.log(`\n  ${loop.rule}\n    FAIL ${e.message}`);
    }
  }
}

// Block timestamps count whole seconds and each chain keeps its own clock, so a step inside the same second can
// read 0 or even -1. Those are reported as "≤ 1 s" rather than with more precision than the data has.
const seconds = (v) => (v === null ? "—" : v <= 1 ? "≤ 1 s" : `${v} s`);
console.log("\n== Time between the steps (block timestamps, whole seconds)\n");
console.log("  | Network | Rule | Origin → Reactive | Reactive → callback | Origin → callback | Blocks, origin → callback |");
console.log("  | --- | --- | --- | --- | --- | --- |");
const blocks = (b) => (b ? `${b.count} ${evidence.chains[b.chain].name} blocks` : "—");
for (const t of timings) {
  console.log(
    `  | ${t.net} | ${t.rule} | ${seconds(t.toReactive)} | ${seconds(t.toCallback)} | ${seconds(t.total)} | ${blocks(t.blocks)} |`,
  );
}

if (only !== "testnet") {
  console.log("\n== The mainnet vault right now\n");
  results.length = 0;
  try {
    console.log((await liveMainnet()).join("\n"));
    console.log(results.join("\n"));
  } catch (e) {
    failures++;
    console.log(`    FAIL ${e.message}`);
  }
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
