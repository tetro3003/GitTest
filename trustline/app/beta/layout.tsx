import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Designer beta" };

export const dynamic = "force-dynamic";

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-16">
      <div className="beta-backdrop" aria-hidden />
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-4">
          <div className="flex items-center gap-2">
            <Logo href="/beta" />
            <span className="rounded-full bg-gradient-to-r from-[#12a594] to-[#5b6cff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Beta</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      {process.env.DEMO_MODE === "1" && (
        <div className="mx-auto mt-3 max-w-6xl px-3">
          <p role="note" className="rounded-2xl border border-amber-400/40 bg-amber-400/15 px-4 py-2 text-center text-sm font-semibold text-amber-800 dark:text-amber-200">
            DEMO MODE · all account data is synthetic, served by local stand-ins for Gmail, Figma, Wise, Webflow, Canva, Miro, Dribbble and the bank. The verification, scoring and review pipeline is real.
          </p>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
