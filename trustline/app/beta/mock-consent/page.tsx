"use client";

import { useEffect, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAMES: Record<string, string> = { google: "Google (Gmail)", figma: "Figma", canva: "Canva", webflow: "Webflow", miro: "Miro", dribbble: "Dribbble", tbc: "TBC Bank", bog: "Bank of Georgia" };

/**
 * DEMO MODE ONLY: stands in for the provider's real consent screen, so the
 * whole connect flow can run without real accounts. Clearly labelled as synthetic.
 */
export default function MockConsent() {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
  if (!q) return null;
  const provider = q.get("provider") ?? "";
  const next = q.get("next") ?? "/beta";
  const safeNext = next.startsWith(window.location.origin) ? next : "/beta";
  const deny = () => {
    const u = new URL(safeNext);
    u.searchParams.delete("code");
    u.searchParams.set("error", "access_denied");
    window.location.href = u.toString();
  };
  return (
    <div className="mx-auto max-w-lg space-y-5 py-10">
      <p className="flex items-center gap-2 rounded-2xl bg-amber-400/20 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
        <FlaskConical className="size-4" /> DEMO MODE · synthetic consent screen standing in for {NAMES[provider] ?? provider}
      </p>
      <div className="glass space-y-4 rounded-3xl p-6">
        <h1 className="font-display text-2xl font-bold">Trustline wants read-only access to your {NAMES[provider] ?? provider} account</h1>
        <p className="text-sm text-muted-foreground">Signed in as <strong>Nino Beridze</strong> (synthetic demo account)</p>
        <div className="rounded-2xl border bg-background/50 p-4 text-sm">
          <p className="mb-1 font-medium">Trustline will be able to:</p>
          <p className="flex items-start gap-2 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" /> {q.get("scopes") || "Read your data"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Read-only. No password is shared. You can revoke access at any time.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={deny}>Cancel</Button>
          <Button className="flex-1 rounded-xl" onClick={() => (window.location.href = safeNext)}>Allow</Button>
        </div>
      </div>
    </div>
  );
}
