"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";
import { type MoneySources, type StewardData, loadHistory, loadSources, loadSteward } from "@/lib/data";
import { NETWORKS, type NetworkKey } from "@/lib/networks";
import { BOOT_KEY } from "@/lib/motion";
import { shortAddress } from "@/lib/format";
import { isPreviewState, previewData, previewHistory, previewSources } from "@/lib/preview";
import { readWatch } from "@/lib/watch";
import { Controls } from "./Controls";
import { GuardianCard } from "./GuardianCard";
import { LoopDiagram } from "./LoopDiagram";
import { MoneyMap } from "./map/MoneyMap";
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

/** The one page: dashboard when the wallet has a vault, setup when it does not. `?watch=0x…` shows anyone's vault read-only. */
export function Steward() {
  const params = useSearchParams();
  const preview = params.get("preview");
  const previewState = isPreviewState(preview) ? preview : null;
  const watch = readWatch(params.get("watch"), params.get("net"));
  const watched = !previewState && watch.kind === "address" ? watch.address : undefined;
  const [network, setNetwork] = useState<NetworkKey>(() =>
    watch.kind === "address" && watch.network && NETWORKS[watch.network].deployment ? watch.network : initialNetwork(),
  );
  const [booting, setBooting] = useState(shouldBoot);
  const { address } = useAccount();
  const now = useNow();
  const queryClient = useQueryClient();

  const chooseNetwork = (key: NetworkKey) => {
    setNetwork(key);
    // A watch link picks its own network; don't let it change the visitor's saved choice.
    if (!watched) localStorage.setItem("steward-network", key);
  };

  // Whose vault the page shows: the watched address, else the connected wallet.
  const viewer = watched ?? address;
  const live = !previewState && viewer !== undefined;
  const data = useQuery({
    queryKey: ["steward", network, viewer],
    queryFn: () => loadSteward(network, viewer!),
    enabled: live,
    refetchInterval: REFRESH_MS,
  });
  const history = useQuery({
    queryKey: ["history", network, viewer],
    queryFn: () => loadHistory(network, viewer!),
    enabled: live && Boolean(data.data?.vault),
    staleTime: 60_000,
  });
  const senders = data.data?.rulebook?.incomeSenders;
  const sources = useQuery({
    queryKey: ["sources", network, viewer, senders],
    queryFn: () => loadSources(network, viewer!, data.data!.vault!, senders ?? []),
    enabled: live && Boolean(data.data?.vault),
    staleTime: 60_000,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["steward", network, viewer] });
    queryClient.invalidateQueries({ queryKey: ["history", network, viewer] });
    queryClient.invalidateQueries({ queryKey: ["sources", network, viewer] });
  };

  // Preview data is fixed at first render so countdowns tick down like the real page.
  const [previewAt] = useState(() => Math.floor(Date.now() / 1000));
  const shown: StewardData | undefined = previewState ? previewData(previewState, previewAt) : data.data;
  const shownHistory = previewState ? previewHistory(previewState, previewAt) : history.data;
  const [shownSources] = useState(() => (previewState ? previewSources(previewState, previewAt) : null));

  return (
    // Springs and slides follow the visitor's reduced-motion setting too, not only CSS animations.
    <MotionConfig reducedMotion="user">
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
              mode={previewState ? "preview" : watched ? "watch" : "wallet"}
            />
          </Reveal>
          {previewState ? (
            <Notice tone="warning" symbol="[!]" word="PREVIEW">
              Sample data showing the {previewState} state, not a real vault. Remove <code>?preview</code> from the
              address to see your own.
            </Notice>
          ) : watched ? (
            <Notice tone="info" symbol=">>" word="WATCHING">
              A read-only view of {shortAddress(watched)}&apos;s real vault, read live from the chain. Nothing can be
              signed here. Remove <code>?watch</code> from the address to connect your own wallet.
            </Notice>
          ) : !previewState && watch.kind === "invalid" ? (
            <Notice tone="danger" symbol="(x)" word="FAILED">
              This watch link has no valid 0x address. Check the link, or connect your wallet to see your own vault.
            </Notice>
          ) : null}
          <Body
            network={previewState ? "testnet" : network}
            connected={previewState !== null || viewer !== undefined}
            user={viewer}
            data={shown}
            history={shownHistory}
            sources={shownSources ?? sources.data}
            sourcesFailed={!shownSources && sources.isError}
            loading={!previewState && data.isPending && live}
            failed={!previewState && data.isError && !data.data}
            now={now}
            preview={previewState !== null}
            watching={watched !== undefined}
            onDone={refresh}
          />
        </main>
      </BootContext.Provider>
    </MotionConfig>
  );
}

type BodyProps = {
  network: NetworkKey;
  connected: boolean;
  user: `0x${string}` | undefined;
  data: StewardData | undefined;
  history: Awaited<ReturnType<typeof loadHistory>> | undefined;
  sources: MoneySources | undefined;
  sourcesFailed: boolean;
  loading: boolean;
  failed: boolean;
  now: number;
  preview: boolean;
  /** A `?watch` link: real data, nothing to sign. */
  watching: boolean;
  onDone: () => void;
};

function Body({
  network,
  connected,
  user,
  data,
  history,
  sources,
  sourcesFailed,
  loading,
  failed,
  now,
  preview,
  watching,
  onDone,
}: BodyProps) {
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
    if (watching) {
      return <Intro>This address has no Steward vault on {n.label.toLowerCase()}.</Intro>;
    }
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

  // Wide screens: the money map takes two thirds, on the left, held in view while the cards scroll
  // in the third on the right. Narrower ones stack the map, two thirds of the screen tall, above them.
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
      <div className="xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)] xl:max-h-[64rem]">
        <MoneyMap data={data} sources={sources} failed={sourcesFailed} preview={preview} now={now} />
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <Reveal order={1} className="grid">
              <VaultCard data={data} />
            </Reveal>
            <Reveal order={2} className="grid">
              <GuardianCard data={data} now={now} readOnly={preview || watching} onDone={onDone} />
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
          <Controls data={data} readOnly={preview || watching} onDone={onDone} />
        </Reveal>
        <Reveal>
          <RecentActions data={data} history={history} now={now} />
        </Reveal>
      </div>
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
