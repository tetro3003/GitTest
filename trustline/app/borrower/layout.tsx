"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Link2, Radar, Send, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPersona } from "@/lib/mock/personas";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/borrower/profile", label: "Profile", icon: Gauge },
  { href: "/borrower/connect", label: "Sources", icon: Link2 },
  { href: "/borrower/work", label: "Work", icon: Radar },
  { href: "/borrower/share", label: "Share", icon: Send },
  { href: "/borrower/consents", label: "My data", icon: ShieldCheck },
];

const FLOW = ["/borrower/onboarding", "/borrower/analyzing"];

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const personaId = useDemo((s) => s.personaId);
  const name = getPersona(personaId)?.borrower.name.split(" ")[0];
  const inFlow = FLOW.some((f) => pathname.startsWith(f));

  return (
    <div className="min-h-dvh pb-24 sm:pb-10">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            {name && (
              <span className="flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3 text-sm">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">{name[0]}</span>
                {name}
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
        {!inFlow && (
          <nav className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2 sm:flex" aria-label="Borrower">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? "page" : undefined}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium", pathname === n.href ? "bg-brand-soft text-brand-strong" : "text-muted-foreground hover:bg-muted")}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      {!inFlow && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur sm:hidden" aria-label="Borrower">
          <ul className="grid grid-cols-5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={pathname === n.href ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", pathname === n.href ? "text-brand" : "text-muted-foreground")}
                >
                  <n.icon className="size-5" />
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
