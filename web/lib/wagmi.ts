// Wallet connection: wagmi + RainbowKit on the four chains Steward uses. Browser wallets
// (MetaMask, including its mobile browser) always work; WalletConnect wallets appear when
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set.
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, createConfig } from "wagmi";
import { NETWORKS } from "./networks";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: projectId
        ? [metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet, injectedWallet]
        : [injectedWallet],
    },
  ],
  { appName: "Steward", projectId: projectId || "steward-browser-wallets-only" },
);

const { testnet, mainnet } = NETWORKS;

export const wagmiConfig = createConfig({
  connectors,
  chains: [testnet.base, testnet.reactive, mainnet.base, mainnet.reactive],
  transports: {
    [testnet.base.id]: http(testnet.baseRpc),
    [testnet.reactive.id]: http(testnet.reactiveRpc),
    [mainnet.base.id]: http(mainnet.baseRpc),
    [mainnet.reactive.id]: http(mainnet.reactiveRpc),
  },
  ssr: true,
});
