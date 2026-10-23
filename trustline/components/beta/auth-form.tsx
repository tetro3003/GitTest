"use client";

import { useState } from "react";
import { ArrowRight, Eye, Loader2, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { betaApi } from "@/lib/beta/client";
import { FigmaMark } from "./brand-icons";

export function AuthForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"freelancer" | "lender">("freelancer");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await betaApi.signup({ email, password, name: String(f.get("name") ?? ""), role, org: String(f.get("org") ?? "") });
      else await betaApi.login({ email, password });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid items-center gap-10 py-4 lg:grid-cols-[1.15fr_1fr] lg:py-10">
      <div>
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
          <span className="live-dot" /> Designer beta · live data, no uploads
        </span>
        <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Your design income, <span className="text-gradient">proven at the source.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">Connect Figma and your wallets. We read straight from them, show you every step, and turn it into a score a bank can trust.</p>
        <ul className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
          {[
            { icon: <FigmaMark className="size-5" />, t: "Real work", d: "Versions & client comments from Figma" },
            { icon: <Wallet className="size-5 text-violet-500" />, t: "Real money", d: "Payments read from the blockchain" },
            { icon: <Eye className="size-5 text-teal-500" />, t: "Fully visible", d: "Every step shown to you, live" },
          ].map((f) => (
            <li key={f.t} className="glass rounded-2xl p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-background/70">{f.icon}</span>
              <p className="mt-3 text-sm font-semibold">{f.t}</p>
              <p className="text-xs text-muted-foreground">{f.d}</p>
            </li>
          ))}
        </ul>
        <div className="night mt-6 hidden max-w-xl rounded-2xl p-4 font-mono text-[12px] leading-relaxed sm:block" aria-hidden>
          {PREVIEW.map((l, i) => (
            <p key={l} className="beta-in" style={{ animationDelay: `${0.4 + i * 0.35}s` }}>
              <span className="text-teal-300">›</span> {l} <span className="text-emerald-300">✓</span>
            </p>
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1" role="tablist">
          {(["signup", "login"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold transition ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "signup" ? "Create account" : "Log in"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">I am a…</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([["freelancer", "Freelancer", "Prove my income"], ["lender", "Lender", "Review applicants"]] as const).map(([v, t, sub]) => (
                    <label key={v} className={`cursor-pointer rounded-xl border p-3 text-sm ${role === v ? "border-brand bg-brand-soft/60" : "hover:bg-muted/60"}`}>
                      <input type="radio" name="role" value={v} className="sr-only" checked={role === v} onChange={() => setRole(v)} />
                      <span className="block font-semibold">{t}</span>
                      <span className="block text-xs text-muted-foreground">{sub}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="name">{role === "lender" ? "Your name" : "Full name (as on your ID)"}</Label>
                <Input id="name" name="name" autoComplete="name" required className="h-11 rounded-xl" />
              </div>
              {role === "lender" && (
                <div className="space-y-1.5">
                  <Label htmlFor="org">Bank or company</Label>
                  <Input id="org" name="org" required placeholder="e.g. City Bank" className="h-11 rounded-xl" />
                </div>
              )}
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required className="h-11 rounded-xl" />
          </div>
          {error && <p className="rounded-xl bg-risk-soft p-3 text-sm text-risk" role="alert">{error}</p>}
          <Button type="submit" size="lg" className="w-full rounded-xl bg-gradient-to-r from-[#12a594] to-[#5b6cff] text-white shadow-lg shadow-teal-500/20 hover:opacity-95" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} {mode === "signup" ? "Create account" : "Log in"}
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3 shrink-0" /> Your password is stored as a one-way hash. We never ask for your Figma, Gmail or wallet passwords.
          </p>
        </form>
      </div>
    </div>
  );
}

const PREVIEW = ["Figma: 48 versions by you in “Bloom app”", "Wallet ownership proven by signature", "Base: 12 USDC payments from 3 clients", "Score 741 · band A"];
