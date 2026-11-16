// Wallet writes, as plain async functions over wagmi actions so multi-step flows read top to bottom.
// Each one switches the wallet to the right chain first, then waits for the receipt on our own RPC.
import type { Abi, Address, Chain, Hash, Hex, TransactionReceipt } from "viem";
import { deployContract, getAccount, signTypedData, switchChain, writeContract } from "wagmi/actions";
import { baseClient, reactiveClient } from "./data";
import type { Network } from "./networks";
import { wagmiConfig } from "./wagmi";

export async function switchTo(chain: Chain): Promise<void> {
  if (getAccount(wagmiConfig).chainId !== chain.id) {
    await switchChain(wagmiConfig, { chainId: chain.id as never });
  }
}

export async function waitFor(network: Network, chain: Chain, hash: Hash): Promise<TransactionReceipt> {
  const client = chain.id === network.base.id ? baseClient(network) : reactiveClient(network);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 360_000 });
  if (receipt.status !== "success") throw new Error("transaction reverted");
  return receipt;
}

type Write = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] };

/** Sends a contract call on `chain` and returns its hash; call `waitFor` for the receipt. */
export async function send(chain: Chain, call: Write): Promise<Hash> {
  await switchTo(chain);
  return writeContract(wagmiConfig, { ...call, chainId: chain.id } as never);
}

export async function deploy(
  chain: Chain,
  abi: Abi,
  bytecode: Hex,
  args: readonly unknown[],
  value: bigint,
): Promise<Hash> {
  await switchTo(chain);
  return deployContract(wagmiConfig, { abi, bytecode, args, value, chainId: chain.id } as never);
}

export async function signTyped(chain: Chain, typed: Parameters<typeof signTypedData>[1]): Promise<Hex> {
  await switchTo(chain);
  return signTypedData(wagmiConfig, typed);
}
