"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";
import { type StewardData, loadHistory, loadSteward } from "@/lib/data";
import { NETWORKS, type NetworkKey } from "@/lib/networks";
import { BOOT_KEY } from "@/lib/motion";
import { isPreviewState, previewData, previewHistory } from "@/lib/preview";
import { Controls } from "./Controls";
import { GuardianCard } from "./GuardianCard";
import { LoopDiagram } from "./LoopDiagram";
import { Boot } from "./motion/Boot";
import { BootContext } from "./motion/BootContext";
import { Reveal } from "./motion/Reveal";
import { RecentActions } from "./RecentActions";
import { RuleCards } from "./RuleCards";
import { SectionNav } from "./SectionNav";
import { SetupFlow } from "./SetupFlow";
import { StatRow } from "./StatRow";
import { TopBar } from "./TopBar";
import { VaultCard } from "./VaultCard";
import { BracketButton, Notice, Spinner, useNow } from "./ui";

const REFRESH_MS = 15_000;

/** The last network picked in this browser, else mainnet once it is deployed. The page renders on the client only (useSearchParams), so localStorage is safe here. */
function initialNetwork(): NetworkKey {
  const saved = typeof window === "undefined" ? null : localStorage.getItem("steward-network");
  if ((saved === "testnet" || saved === "mainnet") && NETWORKS[saved].deployment) return saved;
  return NETWORKS.mainnet.deployment ? "mainnet" : "testnet";
}

/** The boot sequence plays on a tab's first visit, unless the visitor prefers reduced motion. */
function shouldBoot(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return sessionStorage.getItem(BOOT_KEY) === null;
}

/** The one page: dashboard when the wallet has a vault, setup when it does not. */
export function Steward() {
  const params = useSearchParams();
  const preview = params.get("preview");
  const previewState = isPreviewState(preview) ? preview : null;
  const [network, setNetwork] = useState<NetworkKey>(initialNetwork);
  const [booting, setBooting] = useState(shouldBoot);
  const { address } = useAccount();
  const now = useNow();
  const queryClient = useQueryClient();

  const chooseNetwork = (key: NetworkKey) => {
    setNetwork(key);
    localStorage.setItem("steward-network", key);
  };

  const live = !previewState && address !== undefined;
  const data = useQuery({
    queryKey: ["steward", network, address],
    queryFn: () => loadSteward(network, address!),
    enabled: live,
    refetchInterval: REFRESH_MS,
  });
  const history = useQuery({
    queryKey: ["history", network, address],
    queryFn: () => loadHistory(network, address!),
    enabled: live && Boolean(data.data?.vault),
    staleTime: 60_000,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["steward", network, address] });
    queryClient.invalidateQueries({ queryKey: ["history", network, address] });
  };

  // Preview data is fixed at first render so countdowns tick down like the real page.
  const [previewAt] = useState(() => Math.floor(Date.now() / 1000));
  const shown: StewardData | undefined = previewState ? previewData(previewState, previewAt) : data.data;
  const shownHistory = previewState ? previewHistory(previewState, previewAt) : history.data;

  return (
    <BootContext.Provider value={!booting}>
      {booting ? (
        <Boot
          network={NETWORKS[previewState ? "testnet" : network]}
          onDone={() => {
            sessionStorage.setItem(BOOT_KEY, "1");
            setBooting(false);
          }}
        />
      ) : null}
      <main inert={booting} className="mx-auto flex w-full max-w-page flex-col gap-8 px-6 pt-6 pb-24">
        <Reveal>
          <TopBar
            network={previewState ? "testnet" : network}
            onNetwork={chooseNetwork}
            preview={previewState !== null}
          />
        </Reveal>
        {previewState ? (
          <Notice tone="warning" symbol="[!]" word="PREVIEW">
            Sample data showing the {previewState} state, not a real vault. Remove <code>?preview</code> from the
            address to see your own.
          </Notice>
        ) : null}
        <Body
          network={previewState ? "testnet" : network}
          connected={previewState !== null || address !== undefined}
          user={address}
          data={shown}
          history={shownHistory}
          loading={!previewState && data.isPending && live}
          failed={!previewState && data.isError && !data.data}
          now={now}
          preview={previewState !== null}
          onDone={refresh}
        />
      </main>
    </BootContext.Provider>
  );
}

type BodyProps = {
  network: NetworkKey;
  connected: boolean;
  user: `0x${string}` | undefined;
  data: StewardData | undefined;
  history: Awaited<ReturnType<typeof loadHistory>> | undefined;
  loading: boolean;
  failed: boolean;
  now: number;
  preview: boolean;
  onDone: () => void;
};

function Body({ network, connected, user, data, history, loading, failed, now, preview, onDone }: BodyProps) {
  const [settingUp, setSettingUp] = useState(false);
  const n = NETWORKS[network];

  if (!connected) {
    return (
      <Intro>
        Connect your wallet to see your vault and Guardian, or to set up your rules. Steward reads {n.base.name} and{" "}
        {n.reactive.name} directly; there is no server.
      </Intro>
    );
  }
  if (loading) return <Spinner caption={`Reading your vault on ${n.base.name}`} />;
  if (failed || !data) {
    return (
      <Notice tone="danger" symbol="(x)" word="FAILED">
        Could not read {n.base.name}. Check your connection; the page tries again every 15 seconds.
      </Notice>
    );
  }

  if (!data.vault) {
    if (settingUp && (user || preview)) {
      return <SetupFlow networkKey={network} user={user ?? data.user} preview={preview} onDone={onDone} />;
    }
    return (
      <Intro action={<BracketButton onClick={() => setSettingUp(true)}>Set up your rules</BracketButton>}>
        This wallet has no Steward vault on {n.label.toLowerCase()} yet; setting one up takes three signatures and about
        two minutes.
      </Intro>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal order={1} className="grid">
            <VaultCard data={data} />
          </Reveal>
          <Reveal order={2} className="grid">
            <GuardianCard data={data} now={now} preview={preview} onDone={onDone} />
          </Reveal>
        </div>
        <Reveal order={3}>
          <StatRow data={data} history={history} />
        </Reveal>
        <Reveal order={4}>
          <LoopDiagram data={data} history={history} now={now} />
        </Reveal>
      </div>
      <Reveal>
        <RuleCards data={data} />
      </Reveal>
      <Reveal>
        <Controls data={data} preview={preview} onDone={onDone} />
      </Reveal>
      <Reveal>
        <RecentActions data={data} history={history} now={now} />
      </Reveal>
      <SectionNav />
    </div>
  );
}

const VAULT_ART = String.raw`
   .-------------------.
   |  .-------------.  |
   |  |   STEWARD   |  |
   |  |   ( o )--   |  |
   |  '-------------'  |
   '-------------------'
`;

/** Empty state: an ASCII drawing at low contrast, one sentence and one bracket button. */
function Intro({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Reveal>
      <section aria-label="Get started" className="flex flex-col items-center gap-4 py-16 text-center">
        <pre aria-hidden="true" className="font-mono text-sm leading-5 text-ink-muted">
          {VAULT_ART}
        </pre>
        <p className="max-w-xl text-lg text-ink-secondary">{children}</p>
        {action}
      </section>
    </Reveal>
  );
}
