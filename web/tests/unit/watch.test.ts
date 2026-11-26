import { describe, expect, it } from "vitest";
import { readWatch, watchLink } from "@/lib/watch";

const OWNER = "0x810fCBF8A695Ffa0e4480207c667995139F33276";

describe("readWatch", () => {
  it("is off without a watch parameter", () => {
    expect(readWatch(null, null)).toEqual({ kind: "none" });
    expect(readWatch("  ", "mainnet")).toEqual({ kind: "none" });
  });

  it("reads an address in any case and returns it checksummed", () => {
    expect(readWatch(OWNER.toLowerCase(), "mainnet")).toEqual({ kind: "address", address: OWNER, network: "mainnet" });
  });

  it("leaves the network to the page when net is missing or unknown", () => {
    expect(readWatch(OWNER, null)).toEqual({ kind: "address", address: OWNER, network: null });
    expect(readWatch(OWNER, "goerli")).toEqual({ kind: "address", address: OWNER, network: null });
  });

  it("flags a link without a valid address", () => {
    expect(readWatch("0x1234", "mainnet")).toEqual({ kind: "invalid" });
    expect(readWatch("vitalik.eth", null)).toEqual({ kind: "invalid" });
  });

  it("builds a link that reads back to the same vault", () => {
    const link = new URL(watchLink(OWNER, "mainnet"), "https://example.org");
    expect(readWatch(link.searchParams.get("watch"), link.searchParams.get("net"))).toEqual({
      kind: "address",
      address: OWNER,
      network: "mainnet",
    });
  });
});
