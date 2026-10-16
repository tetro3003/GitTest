"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Code2, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/lender", label: "Applicants", icon: Users, match: (p: string) => p === "/lender" || p.startsWith("/lender/applicants") },
  { href: "/lender/monitoring", label: "Monitoring", icon: Bell, match: (p: string) => p.startsWith("/lender/monitoring") },
  { href: "/lender/api", label: "API", icon: Code2, match: (p: string) => p.startsWith("/lender/api") },
];

export default function LenderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.endsWith("/report")) return <>{children}</>;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="no-print sticky top-0 z-30 border-b bg-card lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16 lg:px-5">
          <Logo href="/" suffix="Lender" />
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:px-3 lg:pb-0" aria-label="Lender">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap", active ? "bg-brand-soft text-brand-strong" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 hidden items-center justify-between px-5 lg:flex">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">City Bank</p>
            <p>Retail lending team</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
