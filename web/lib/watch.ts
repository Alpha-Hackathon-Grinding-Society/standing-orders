// `?watch=0x…` opens anyone's vault read-only, with no wallet: real data, every signing button disabled.
// `&net=mainnet|testnet` picks the network, so a shared link always opens the same vault.
import { type Address, getAddress, isAddress } from "viem";
import type { NetworkKey } from "./networks";

export type Watch =
  { kind: "none" } | { kind: "invalid" } | { kind: "address"; address: Address; network: NetworkKey | null };

export function readWatch(watch: string | null, net: string | null): Watch {
  if (watch === null || watch.trim() === "") return { kind: "none" };
  const text = watch.trim();
  if (!isAddress(text, { strict: false })) return { kind: "invalid" };
  const network = net === "mainnet" || net === "testnet" ? net : null;
  return { kind: "address", address: getAddress(text), network };
}

/** The shareable link for a vault, relative to the page. */
export function watchLink(address: Address, network: NetworkKey): string {
  return `/?watch=${address}&net=${network}`;
}
