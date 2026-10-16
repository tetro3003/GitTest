import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Eye, FileCheck2, Link2, Lock, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { CURRENCY, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config";

const STEPS = [
  { icon: Link2, title: "Connect what you choose", body: "Bank accounts, ride-hailing, delivery and freelance platforms, bills. Read-only, with a clear expiry." },
  { icon: Sparkles, title: "We verify & explain", body: "Transactions are categorized, income is verified conservatively and work activity is checked against earnings." },
  { icon: FileCheck2, title: "Share a bank-ready profile", body: "A score from 300–850, verified monthly income and the payment you can afford — with every reason shown." },
];

const SEGMENTS = ["Taxi drivers", "Couriers", "IT freelancers", "Tutors", "Repair workers"];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link href="/demo" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
            Personas
          </Link>
          <Link href="/lender/api" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
            API
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-brand" /> Consent-based alternative credit scoring
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              You earn every day.
              <br />
              <span className="text-brand">Now banks can see it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">{PRODUCT_TAGLINE}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/borrower/onboarding">
                  <UserRound /> I&apos;m self-employed <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/lender">
                  <Building2 /> I&apos;m a lender
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Built for {SEGMENTS.join(" · ")}</p>
          </div>

          {/* Product preview card */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-soft via-transparent to-transparent" />
            <div className="rounded-2xl border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Giorgi B. · Taxi driver</p>
                  <p className="font-display text-xl font-semibold">Income & risk profile</p>
                </div>
                <span className="rounded-md bg-positive-soft px-2 py-1 text-sm font-semibold text-positive">Band A</span>
              </div>
              <dl className="mt-6 grid grid-cols-3 gap-4">
                {[
                  ["Score", "767"],
                  ["Verified income", `${CURRENCY.symbol}2,519`],
                  ["Max payment", `${CURRENCY.symbol}350`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="tabular font-display text-2xl font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-6 space-y-2 text-sm">
                {[
                  ["+79", "Very steady monthly income"],
                  ["+50", "Bills always paid on time"],
                  ["+50", "45 hrs/week on RideCo for 2 years (opt-in)"],
                  ["−20", "91% of income from one platform"],
                ].map(([pts, txt]) => (
                  <li key={txt} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                    <span>{txt}</span>
                    <span className={`tabular font-semibold ${pts.startsWith("+") ? "text-positive" : "text-risk"}`}>{pts}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
            <div className="md:col-span-1">
              <h2 className="font-display text-3xl font-bold tracking-tight">Invisible to banks</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3 md:col-span-2">
              {[
                ["No payslip", "Self-employed people without a registered business can't produce the documents banks ask for."],
                ["Scattered income", "Money arrives from platforms, clients and transfers across several accounts."],
                ["Priced as high risk", "So they get declined — or pushed to expensive micro-loans despite steady work."],
              ].map(([t, b]) => (
                <div key={t}>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border bg-card p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                </div>
                <p className="font-display text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Privacy */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-8 rounded-3xl bg-brand px-6 py-12 text-brand-foreground md:grid-cols-[1.2fr_1fr] md:px-12">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Your data, your control.</h2>
              <p className="mt-3 max-w-lg opacity-90">Share only what you choose, revoke anytime. Work-activity data is an opt-in boost: it can raise your score, and not sharing it never lowers it.</p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                [Lock, "Read-only access with an expiry date on every connection"],
                [Eye, "See exactly what each lender receives before you share"],
                [BadgeCheck, "Every score comes with the reasons behind it"],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={t as string} className="flex items-start gap-3">
                    <I className="mt-0.5 size-4 shrink-0" /> <span>{t as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© 2026 {PRODUCT_NAME} · Hackathon prototype with synthetic data</span>
          <span className="flex gap-4">
            <Link href="/demo" className="hover:text-foreground">Demo personas</Link>
            <Link href="/lender/api" className="hover:text-foreground">API docs</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
