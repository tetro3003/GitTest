"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, FlaskConical, LayoutGrid, Loader2, RotateCcw, User, X } from "lucide-react";
import { api } from "@/lib/api";
import { API_MODE } from "@/lib/config";
import { FEATURED_PERSONA_IDS, getPersona } from "@/lib/mock/personas";
import { useDemo, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Floating stage-demo controls: role, persona, error simulation and reset. */
export function DemoPanel() {
  const { panelOpen, setPanelOpen, role, setRole, personaId, setPersona, simulateErrors, setSimulateErrors, invalidate } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanelOpen]);

  // Keep the role in sync with where the user is.
  useEffect(() => {
    if (pathname.startsWith("/lender") && role !== "lender") setRole("lender");
    if (pathname.startsWith("/borrower") && role !== "borrower") setRole("borrower");
  }, [pathname, role, setRole]);

  const switchRole = (r: Role) => {
    setRole(r);
    router.push(r === "lender" ? "/lender" : "/borrower/profile");
  };

  const pickPersona = (id: string) => {
    setPersona(id);
    if (pathname.startsWith("/lender/applicants/")) router.push(`/lender/applicants/${id}`);
  };

  const reset = async () => {
    setResetting(true);
    try {
      await api.resetDemo();
      setSimulateErrors(false);
      invalidate();
      router.push(role === "lender" ? "/lender" : "/borrower/profile");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="no-print fixed bottom-20 right-4 z-40 sm:bottom-5 sm:right-5">
      {panelOpen ? (
        <div role="dialog" aria-label="Demo controls" className="w-[min(92vw,340px)] rounded-2xl border bg-card p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-display text-sm font-semibold">
              <FlaskConical className="size-4 text-brand" /> Demo controls
            </p>
            <button onClick={() => setPanelOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close demo controls">
              <X className="size-4" />
            </button>
          </div>

          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Role">
            {(["borrower", "lender"] as const).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={role === r}
                onClick={() => switchRole(r)}
                className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium capitalize", role === r ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {r === "borrower" ? <User className="size-4" /> : <Briefcase className="size-4" />}
                {r}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Persona</p>
          <ul className="mb-4 space-y-1" role="radiogroup" aria-label="Persona">
            {FEATURED_PERSONA_IDS.map((id) => {
              const p = getPersona(id);
              if (!p) return null;
              return (
                <li key={id}>
                  <button
                    role="radio"
                    aria-checked={personaId === id}
                    onClick={() => pickPersona(id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                      personaId === id ? "border-brand bg-brand-soft" : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className="font-medium">{p.borrower.name.split(" ")[0]}</span>
                    <span className="text-xs text-muted-foreground">{p.borrower.tagline}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/demo" onClick={() => setPanelOpen(false)}>
                <LayoutGrid /> All personas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={role === "lender" ? `/lender/applicants/${personaId}` : "/borrower/onboarding"} onClick={() => setPanelOpen(false)}>
                {role === "lender" ? "Open applicant" : "Start onboarding"}
              </Link>
            </Button>
          </div>

          {API_MODE === "mock" && (
            <label className="mb-3 flex items-center justify-between gap-2 text-sm">
              <span>Simulate API errors</span>
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={simulateErrors} onChange={(e) => setSimulateErrors(e.target.checked)} />
            </label>
          )}

          <Button variant="secondary" size="sm" className="w-full" onClick={reset} disabled={resetting}>
            {resetting ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset demo
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lg hover:bg-muted"
          aria-label="Open demo controls"
        >
          <FlaskConical className="size-4 text-brand" /> Demo
        </button>
      )}
    </div>
  );
}
