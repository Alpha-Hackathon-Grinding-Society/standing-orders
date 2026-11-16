"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import { type Address, type Hex, keccak256, maxUint256, parseAbi, parseSignature, zeroAddress } from "viem";
import { erc20Abi, factoryAbi, rulebookAbi } from "@/lib/abi";
import { baseClient } from "@/lib/data";
import { formatAmount } from "@/lib/format";
import generated from "@/lib/generated/contracts.json";
import { NETWORKS, type NetworkKey, chainName } from "@/lib/networks";
import { permitDomain, permitMessage, permitTypes } from "@/lib/permit";
import { rulebookConfig, rulebookDeployData } from "@/lib/rulebook";
import { type SetupField, type SetupForm, defaultForm, reviewLines, validateSetup } from "@/lib/setup";
import { type TxStatus, WAITING, errorText } from "@/lib/tx";
import { deploy, send, signTyped, waitFor } from "@/lib/wallet";
import { TxRow } from "./TxRow";
import { Label, Notice, Panel, PrimaryButton } from "./ui";

const vestingOwnerAbi = parseAbi(["function owner() view returns (address)"]);

type Step = "rulebook" | "vesting" | "permit" | "vault";
type Saved = { rulebook: Address; hash: Hex; dataHash: Hex };

/**
 * Setup on the same page when the wallet has no vault: the three rule cards as plain-language fields,
 * a `// REVIEW` panel, then the signatures. Reactive comes first because the vault registers the
 * Rulebook's address (NOTES.md, Design A).
 */
export function SetupFlow({
  networkKey,
  user,
  preview,
  onDone,
}: {
  networkKey: NetworkKey;
  user: Address;
  /** Preview shows the form and review but never asks the wallet for anything. */
  preview: boolean;
  onDone: () => void;
}) {
  const network = NETWORKS[networkKey];
  const [form, setForm] = useState<SetupForm>(() => ({ ...defaultForm(network), beneficiary: "" }));
  const [touched, setTouched] = useState<Partial<Record<SetupField, boolean>>>({});
  const [steps, setSteps] = useState<Record<Step, TxStatus>>({
    rulebook: WAITING,
    vesting: WAITING,
    permit: WAITING,
    vault: WAITING,
  });
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { errors, plan } = useMemo(() => validateSetup(form, user), [form, user]);
  const storageKey = `steward-rulebook-${networkKey}-${user.toLowerCase()}`;

  const set = (field: keyof SetupForm, value: string | boolean) => setForm((f) => ({ ...f, [field]: value }));
  const shown = (field: SetupField) => (touched[field] ? errors[field] : undefined);
  const mark = (step: Step, status: TxStatus) => setSteps((s) => ({ ...s, [step]: status }));
  const field = (name: SetupField) => ({
    value: form[name],
    error: shown(name),
    onChange: (v: string) => set(name, v),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
  });

  async function signSetup() {
    setError(null);
    if (!plan) {
      setTouched(Object.fromEntries(Object.keys(errors).map((k) => [k, true])));
      setError("Some answers above need a fix before anything is signed. They are marked in red.");
      return;
    }
    const d = network.deployment;
    if (!d) return;
    const base = baseClient(network);
    setRunning(true);
    let current: Step = "rulebook";
    try {
      // Checks that need no signature.
      const existing = await base.readContract({
        address: d.vaultFactory,
        abi: factoryAbi,
        functionName: "vaultOf",
        args: [user],
      });
      if (existing !== zeroAddress)
        throw new Error("This wallet already has a vault on this network. Reload the page to see it");
      if (plan.choices.claim) {
        const owner = await base
          .readContract({ address: plan.choices.claim.vesting, abi: vestingOwnerAbi, functionName: "owner" })
          .catch(() => {
            throw new Error(
              "That vesting address is not a vesting contract on this network. Check the address, or turn Claim and secure off",
            );
          });
        if (owner.toLowerCase() !== user.toLowerCase()) {
          throw new Error(
            "That vesting contract pays a different wallet. Connect the wallet it vests to, or turn Claim and secure off",
          );
        }
      }
      const vault = await base.readContract({
        address: d.vaultFactory,
        abi: factoryAbi,
        functionName: "predictVault",
        args: [user],
      });
      const config = rulebookConfig(network, vault, plan.choices);
      const data = rulebookDeployData(config);

      // 1. Rulebook on Reactive (reused if the same rules were already deployed from this browser).
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Saved | null;
      let rulebook: Address;
      if (saved && saved.dataHash === keccak256(data)) {
        rulebook = saved.rulebook;
        mark("rulebook", {
          state: "success",
          hash: saved.hash,
          explorer: network.reactiveExplorer,
          note: "DEPLOYED EARLIER",
        });
      } else {
        mark("rulebook", { state: "pending", note: "CONFIRM IN WALLET" });
        const hash = await deploy(
          network.reactive,
          rulebookAbi,
          generated.rulebookBytecode as Hex,
          [config],
          plan.funding,
        );
        mark("rulebook", { state: "pending", hash, explorer: network.reactiveExplorer });
        const receipt = await waitFor(network, network.reactive, hash);
        if (!receipt.contractAddress) throw new Error("The deploy confirmed without a contract address");
        rulebook = receipt.contractAddress;
        localStorage.setItem(storageKey, JSON.stringify({ rulebook, hash, dataHash: keccak256(data) } satisfies Saved));
        mark("rulebook", { state: "success", hash, explorer: network.reactiveExplorer });
      }

      // 2. One-time approval for the vesting token, if Claim and secure is on.
      current = "vesting";
      if (plan.choices.claim) {
        const token = plan.choices.claim.vestingToken;
        const allowance = await base.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [user, d.ordersExecutor],
        });
        if (allowance < maxUint256 / 2n) {
          mark("vesting", { state: "pending", note: "CONFIRM IN WALLET" });
          const hash = await send(network.base, {
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [d.ordersExecutor, maxUint256],
          });
          mark("vesting", { state: "pending", hash, explorer: network.baseExplorer });
          await waitFor(network, network.base, hash);
          mark("vesting", { state: "success", hash, explorer: network.baseExplorer });
        } else {
          mark("vesting", { state: "success", note: "ALREADY APPROVED" });
        }
      }

      // 3. USDC permit: the executor may move at most the budget, only into this vault.
      current = "permit";
      mark("permit", { state: "pending", note: "SIGN IN WALLET" });
      const [domain, nonce] = await Promise.all([
        permitDomain(base, d.usdc, network.base.id),
        base.readContract({ address: d.usdc, abi: erc20Abi, functionName: "nonces", args: [user] }),
      ]);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3_600);
      const signature = await signTyped(network.base, {
        domain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage(user, d.ordersExecutor, plan.budget, nonce, deadline),
      });
      const { r, s, v, yParity } = parseSignature(signature);
      mark("permit", { state: "success", note: "SIGNED" });

      // 4. Create the vault: applies the permit and registers the Rulebook with the executor.
      current = "vault";
      mark("vault", { state: "pending", note: "CONFIRM IN WALLET" });
      const hash = await send(network.base, {
        address: d.vaultFactory,
        abi: factoryAbi,
        functionName: "createVault",
        args: [
          { token: d.usdc, rulebook, beneficiary: plan.beneficiary },
          { value: plan.budget, deadline, v: Number(v ?? BigInt(yParity + 27)), r, s },
        ],
      });
      mark("vault", { state: "pending", hash, explorer: network.baseExplorer });
      await waitFor(network, network.base, hash);
      mark("vault", { state: "success", hash, explorer: network.baseExplorer });
      localStorage.removeItem(storageKey);
      onDone();
    } catch (e) {
      mark(current, { state: "failed" });
      setError(errorText(e));
    } finally {
      setRunning(false);
    }
  }

  const reactSymbol = network.reactive.nativeCurrency.symbol;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="setup-title" className="flex flex-col gap-4">
        <Label id="setup-title">Set up your rules</Label>
        <p className="max-w-2xl text-ink-secondary">
          Answer in plain numbers. Nothing is signed until you review it below. Steward runs on {network.base.name} and{" "}
          {network.reactive.name}.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <RuleFields
            title="Pay yourself first"
            sentence="Save a share of every USDC payment from the addresses that pay you."
          >
            <Field label="Share to save (%)" hint="1 to 50" {...field("splitPercent")} inputMode="decimal" />
            <Field
              label="Addresses that pay you"
              hint="Full 0x addresses, separated by commas or new lines"
              multiline
              {...field("incomeSenders")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="At most (USDC)" {...field("periodCap")} inputMode="decimal" />
              <Field label="Every (days)" {...field("periodDays")} inputMode="decimal" />
            </div>
            <Field
              label="Total Steward may ever move (USDC)"
              hint="The USDC permit you sign. Steward can only move it into your vault."
              {...field("budget")}
              inputMode="decimal"
            />
          </RuleFields>

          <RuleFields
            title="Claim and secure"
            sentence="Claim what has vested in your vesting contract and move it into your vault."
          >
            <Toggle label="Turn on Claim and secure" checked={form.claimOn} onChange={(v) => set("claimOn", v)} />
            {form.claimOn ? (
              <>
                <Field
                  label="Vesting contract"
                  hint="An OpenZeppelin VestingWallet that pays this wallet"
                  {...field("vesting")}
                />
                <Field label="Token that vests" {...field("vestingToken")} />
                <Field label="Check every (hours)" {...field("claimHours")} inputMode="decimal" />
                <p className="text-sm text-ink-muted">
                  Claims land in your vault. To forward them to a cold wallet, set one after setup with{" "}
                  <code>make propose-cold-wallet</code>; it takes effect after 24 hours.
                </p>
              </>
            ) : null}
          </RuleFields>

          <RuleFields
            title="Guardian"
            sentence="If you go silent on every watched chain, warn you, wait, then send your savings to someone you trust."
          >
            <Toggle label="Turn on the Guardian" checked={form.guardianOn} onChange={(v) => set("guardianOn", v)} />
            {form.guardianOn ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Silent for (days)" {...field("silenceDays")} inputMode="decimal" />
                <Field label="Then wait (days)" {...field("graceDays")} inputMode="decimal" />
              </div>
            ) : null}
            <Field
              label="Beneficiary"
              hint="Receives your savings after a full Guardian cycle. Changing it later takes 24 hours."
              {...field("beneficiary")}
            />
            <p className="font-mono text-sm text-ink-muted">
              Watched: {network.watchedChains.map(chainName).join(" and ")}
            </p>
          </RuleFields>
        </div>
      </section>

      <Panel title="Review" id="review-title">
        {plan ? (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-ink-default">
            {reviewLines(plan, network).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : (
          <p className="text-ink-secondary">
            Fill in the fields above; your rules appear here in plain English before you sign.
          </p>
        )}
      </Panel>

      <Panel title="Sign" id="sign-title">
        <div className="max-w-xs">
          <Field
            label={`${reactSymbol} for your Rulebook`}
            hint="Pays for its checks, about 1 a day"
            {...field("funding")}
            inputMode="decimal"
          />
        </div>
        <ul className="flex flex-col">
          <TxRow label={`1. Deploy your Rulebook on ${network.reactive.name}`} status={steps.rulebook} />
          {form.claimOn ? (
            <TxRow label={`2. Approve the vesting token on ${network.base.name}`} status={steps.vesting} />
          ) : null}
          <TxRow
            label={`${form.claimOn ? 3 : 2}. Sign the USDC permit on ${network.base.name}`}
            status={steps.permit}
          />
          <TxRow label={`${form.claimOn ? 4 : 3}. Create your vault on ${network.base.name}`} status={steps.vault} />
        </ul>
        <PrimaryButton onClick={signSetup} disabled={running || preview} className="self-start">
          {running ? "Signing..." : "Sign setup"}
        </PrimaryButton>
        <p className="text-sm text-ink-muted">
          Your wallet switches between {network.reactive.name} and {network.base.name} on its own. The Rulebook deploy
          also sends {plan ? formatAmount(plan.funding, 18, reactSymbol) : `the ${reactSymbol} above`} plus a network
          fee.
        </p>
        {error ? (
          <Notice tone="danger" symbol="(x)" word="FAILED">
            {error}
          </Notice>
        ) : null}
      </Panel>
    </div>
  );
}

function RuleFields({ title, sentence, children }: { title: string; sentence: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-xl border-2 border-hairline bg-linear-to-b from-card-from to-surface p-4 md:p-6">
      <legend className="sr-only">{title}</legend>
      <h3 aria-hidden="true" className="text-xl font-medium text-ink">
        {title}
      </h3>
      <p className="text-ink-secondary">{sentence}</p>
      {children}
    </fieldset>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  multiline?: boolean;
  inputMode?: "decimal" | "text";
};

/** A labelled input: label above, hint and error below, error shown after the field is left. */
function Field({ label, hint, value, error, onChange, onBlur, multiline, inputMode = "text" }: FieldProps) {
  const id = useId();
  const described = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described,
    autoComplete: "off",
    spellCheck: false,
    className:
      "w-full rounded-md bg-surface-input px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-maya aria-invalid:ring-1 aria-invalid:ring-danger-text",
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-mono text-sm uppercase text-ink-secondary">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          inputMode={inputMode}
          className={`${common.className} min-h-11`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 font-mono text-sm uppercase">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-royal"
      />
      <span>
        {label} <span className={checked ? "text-success" : "text-ink-muted"}>[ {checked ? "ON" : "OFF"} ]</span>
      </span>
    </label>
  );
}
