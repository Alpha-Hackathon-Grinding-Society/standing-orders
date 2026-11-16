// Copies what the page needs from contracts/ into lib/generated/contracts.json:
// the Rulebook's creation bytecode (the page deploys it from the user's wallet) and the
// shared Base deployments per network. Run after `forge build` or a new deploy: pnpm sync
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contracts = join(here, "..", "..", "contracts");
const out = join(here, "..", "lib", "generated", "contracts.json");

const artifact = JSON.parse(readFileSync(join(contracts, "out", "Rulebook.sol", "Rulebook.json"), "utf8"));
const deployment = (name) => {
  const file = join(contracts, "deployments", `${name}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
};

const result = {
  rulebookBytecode: artifact.bytecode.object,
  deployments: { testnet: deployment("base-sepolia"), mainnet: deployment("base") },
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(
  `wrote ${out}: Rulebook bytecode ${(result.rulebookBytecode.length - 2) / 2} bytes;`,
  `testnet ${result.deployments.testnet ? "yes" : "no"}, mainnet ${result.deployments.mainnet ? "yes" : "no"}`,
);
