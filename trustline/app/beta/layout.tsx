import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Designer beta" };

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
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
