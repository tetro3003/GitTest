"use client";

import { useEffect, useState } from "react";
import { Check, Copy, EyeOff, Loader2, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { betaApi } from "@/lib/beta/client";
import type { BetaConnection, ChainFamily, WalletChallenge } from "@/lib/beta/types";
import { discoverWallets, type BrowserWallet } from "@/lib/beta/wallet-browser";
import { cn } from "@/lib/utils";
import { ChainMark } from "./brand-icons";
import { ConnectionActions, lastSync, StatusBadge } from "./connection-bits";

const NETWORKS: { id: ChainFamily; name: string; reads: string; wallets: string }[] = [
  { id: "evm", name: "Ethereum & EVM", reads: "USDT/USDC on Ethereum, Base, Polygon, Arbitrum, Optimism", wallets: "MetaMask, Phantom, Rabby, Coinbase Wallet, Trust, OKX…" },
  { id: "solana", name: "Solana", reads: "USDT/USDC on Solana", wallets: "Phantom, Solflare, Backpack" },
  { id: "tron", name: "Tron", reads: "USDT on Tron (TRC-20)", wallets: "TronLink, Trust, or any Tron wallet" },
];

export function WalletsCard({ wallets, onChange, onError }: { wallets: BetaConnection[]; onChange: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChange();
    } catch (e) {
      onError((e as Error).message);
    }
  };
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25"><Wallet className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Crypto wallets</p>
          <p className="text-sm text-muted-foreground">Add as many as you use. Each one is proven yours with a free signature, then read from the blockchain.</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}><Plus /> Add wallet</Button>
      </div>
      {wallets.length > 0 && (
        <ul className="mt-4 space-y-2">
          {wallets.map((w) => (
            <li key={w.id} className="flex items-center gap-3 rounded-2xl border bg-background/50 px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted"><ChainMark family={w.settings.family as ChainFamily} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{w.label}</span>
                  <StatusBadge c={w} />
                </div>
                <p className="text-xs text-muted-foreground">{String(w.settings.network)} · {w.stats.payments} income payments · {lastSync(w)}</p>
                {w.lastError && <p className="text-xs text-risk">{w.lastError}</p>}
              </div>
              <ConnectionActions c={w} onSync={() => act(() => betaApi.sync(w.id))} onDisconnect={() => act(() => betaApi.disconnect(w.id))} />
            </li>
          ))}
        </ul>
      )}
      <AddWalletDialog open={open} onOpenChange={setOpen} onAdded={onChange} />
    </div>
  );
}

type Step = { text: string; state: "doing" | "done" | "failed" };

function AddWalletDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) {
  const [family, setFamily] = useState<ChainFamily>("evm");
  const [found, setFound] = useState<BrowserWallet[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [challenge, setChallenge] = useState<WalletChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSteps([]);
    setError(null);
    setChallenge(null);
    setManual(false);
    void discoverWallets().then(setFound);
  }, [open]);

  const push = (text: string) => setSteps((s) => [...s.map((x) => (x.state === "doing" ? { ...x, state: "done" as const } : x)), { text, state: "doing" }]);
  const finish = (ok: boolean) => setSteps((s) => s.map((x) => (x.state === "doing" ? { ...x, state: ok ? ("done" as const) : ("failed" as const) } : x)));

  const auto = async (w: BrowserWallet) => {
    setBusy(true);
    setError(null);
    setSteps([]);
    try {
      push(`Asking ${w.name} for your address`);
      const address = await w.connect();
      push(`Creating a one-time message for ${address.slice(0, 6)}…${address.slice(-4)}`);
      const ch = await betaApi.walletChallenge(w.family, address);
      push(`Waiting for you to sign in ${w.name} (free, moves no money)`);
      const sig = await w.sign(ch.message, address);
      push("Checking the signature on our server");
      await betaApi.walletVerify(ch.challengeId, sig, w.name);
      push("Ownership proven. Reading payments from the blockchain…");
      finish(true);
      onAdded();
      setTimeout(() => onOpenChange(false), 900);
    } catch (e) {
      finish(false);
      const msg = (e as { code?: number; message: string }).code === 4001 ? "You cancelled in the wallet." : (e as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const startManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      setChallenge(await betaApi.walletChallenge(family, String(new FormData(e.currentTarget).get("address") ?? "")));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const finishManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await betaApi.walletVerify(challenge!.challengeId, String(f.get("signature") ?? ""), String(f.get("walletName") ?? ""));
      onAdded();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const available = (found ?? []).filter((w) => w.family === family);

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Add a crypto wallet</DialogTitle>
        <DialogDescription>You&apos;ll sign a short message to prove the wallet is yours. It&apos;s free and moves no money.</DialogDescription>

        <fieldset className="mt-4 space-y-2" disabled={busy}>
          <legend className="mb-1 text-sm font-medium">1. Which network?</legend>
          {NETWORKS.map((n) => (
            <label key={n.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors", family === n.id ? "border-brand bg-brand-soft/60 shadow-sm" : "hover:bg-muted/60")}>
              <ChainMark family={n.id} className="mt-0.5 size-6 shrink-0" />
              <input type="radio" name="family" className="sr-only" checked={family === n.id} onChange={() => { setFamily(n.id); setChallenge(null); }} />
              <span className="text-sm">
                <span className="font-medium">{n.name}</span>
                <span className="block text-muted-foreground">{n.wallets}</span>
                <span className="block text-xs text-muted-foreground">We read: {n.reads}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium">2. Sign with your wallet</p>
          {found === null && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Looking for wallets in this browser…</p>}
          {found && !manual && (
            <>
              {available.length ? (
                <div className="grid gap-2">
                  {available.map((w) => (
                    <Button key={w.id} variant="outline" className="justify-start" disabled={busy} onClick={() => auto(w)}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are data: URIs from the extension */}
                      {w.icon ? <img src={w.icon} alt="" className="size-5 rounded" /> : <Wallet />} Connect &amp; sign with {w.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">No {NETWORKS.find((n) => n.id === family)?.name} wallet found in this browser. Install its browser extension, or sign manually below (works with phone and hardware wallets).</p>
              )}
              <button className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setManual(true)} disabled={busy}>
                Sign manually instead
              </button>
            </>
          )}

          {manual && !challenge && (
            <form onSubmit={startManual} className="space-y-2">
              <Label htmlFor="w-address">Wallet address</Label>
              <Input id="w-address" name="address" required autoComplete="off" className="font-mono text-xs" />
              <Button type="submit" size="sm">Get message to sign</Button>
            </form>
          )}
          {manual && challenge && (
            <form onSubmit={finishManual} className="space-y-2">
              <p className="text-sm">Sign this exact text in your wallet&apos;s “Sign message” feature, then paste the signature.</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs">{challenge.message}</pre>
              <Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(challenge.message); setCopied(true); }}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy message"}
              </Button>
              <Label htmlFor="w-name">Wallet app (for your list)</Label>
              <Input id="w-name" name="walletName" placeholder="e.g. Ledger, Trust Wallet" />
              <Label htmlFor="w-sig">Signature</Label>
              <textarea id="w-sig" name="signature" required rows={3} className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs" />
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Verify</Button>
            </form>
          )}

          {steps.length > 0 && (
            <ol className="space-y-1.5 rounded-xl border p-3 text-sm" aria-live="polite">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  {s.state === "doing" ? <Loader2 className="size-4 animate-spin text-brand" /> : s.state === "done" ? <Check className="size-4 text-positive" /> : <span className="size-4 text-center text-risk">✕</span>}
                  {s.text}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-sm text-risk" role="alert">{error}</p>}
        </div>

        <p className="mt-5 flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <EyeOff className="size-4 shrink-0" />
          <span><strong>Privacy wallets</strong> (Hinkal, Railgun, Monero…) hide payments by design, so they can&apos;t be proven. Income counts when a client pays to a normal address; you can still add that address here.</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
