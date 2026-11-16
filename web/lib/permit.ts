// The EIP-2612 USDC permit the user signs during setup: it lets the executor move at most `value`
// USDC, and VaultFactory applies it in the same transaction that creates the vault.
import { type Address, type PublicClient, type TypedDataDomain } from "viem";
import { erc20Abi } from "./abi";

/** Reads the token's EIP-712 domain: EIP-5267 if it has it, else name() and version() (USDC), else version "1". */
export async function permitDomain(client: PublicClient, token: Address, chainId: number): Promise<TypedDataDomain> {
  try {
    const [, name, version] = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "eip712Domain",
    });
    return { name, version, chainId, verifyingContract: token };
  } catch {
    const name = await client.readContract({ address: token, abi: erc20Abi, functionName: "name" });
    const version = await client
      .readContract({ address: token, abi: erc20Abi, functionName: "version" })
      .catch(() => "1");
    return { name, version, chainId, verifyingContract: token };
  }
}

export const permitTypes = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function permitMessage(owner: Address, spender: Address, value: bigint, nonce: bigint, deadline: bigint) {
  return { owner, spender, value, nonce, deadline };
}
