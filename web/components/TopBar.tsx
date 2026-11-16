"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";
import { NETWORKS, type NetworkKey } from "@/lib/networks";
import { BracketButton } from "./ui";

type Props = {
  network: NetworkKey;
  onNetwork: (key: NetworkKey) => void;
  /** In preview mode the wallet button is replaced by a note. */
  preview: boolean;
};

/** Logo, network switch, "Built on Reactive" badge and `[ CONNECT WALLET ]`. */
export function TopBar({ network, onNetwork, preview }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
      <Link href="/" className="flex items-center gap-3" aria-label="Steward home">
        <Image
          src="/brand/steward-logo-horizontal-dark-transparent.svg"
          alt="Steward"
          width={149}
          height={48}
          priority
        />
      </Link>

      <nav aria-label="Network and wallet" className="flex flex-wrap items-center gap-2 font-mono text-sm uppercase">
        <div role="group" aria-label="Network" className="flex items-center rounded-md border border-hairline">
          {(Object.keys(NETWORKS) as NetworkKey[]).map((key) => {
            const n = NETWORKS[key];
            const ready = n.deployment !== null;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={network === key}
                disabled={!ready}
                title={ready ? `${n.base.name} + ${n.reactive.name}` : `Not deployed on ${n.label.toLowerCase()} yet`}
                onClick={() => onNetwork(key)}
                className={`min-h-11 cursor-pointer px-3 uppercase transition-colors duration-300 ease-reactive disabled:cursor-not-allowed disabled:text-ink-muted ${
                  network === key ? "bg-surface-active text-ink" : "text-ink-secondary hover:text-white"
                }`}
              >
                {n.label}
                {ready ? "" : " · soon"}
              </button>
            );
          })}
        </div>

        <a
          href="https://reactive.network"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-2 rounded-md border border-hairline px-3 text-ink-secondary transition-colors duration-300 ease-reactive hover:text-white"
        >
          <span aria-hidden="true" className="inline-block size-2 bg-success" />
          Built on Reactive <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens reactive.network in a new tab)</span>
        </a>

        {preview ? (
          <span className="px-3 text-warning">[!] Preview</span>
        ) : (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              if (!mounted) return <BracketButton disabled>Connect wallet</BracketButton>;
              if (!account) return <BracketButton onClick={openConnectModal}>Connect wallet</BracketButton>;
              return (
                <BracketButton onClick={openAccountModal} title={chain?.name}>
                  {account.displayName}
                </BracketButton>
              );
            }}
          </ConnectButton.Custom>
        )}
      </nav>
    </header>
  );
}
