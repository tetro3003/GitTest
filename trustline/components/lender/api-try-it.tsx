"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { API_BASE_URL, API_MODE, LENDER_API_KEY } from "@/lib/config";

/** Calls the real backend from the docs page: exchange a share code for a report. */
export function ApiTryIt() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string>("");

  if (API_MODE !== "live")
    return (
      <Card>
        <CardHeader>
          <CardTitle>Try it</CardTitle>
          <CardDescription>Run the app with the backend (npm run dev on your laptop) to call the API from here.</CardDescription>
        </CardHeader>
      </Card>
    );

  const run = async (path: string, init?: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${LENDER_API_KEY}` } });
      const body = await res.json();
      setOut(`HTTP ${res.status}\n${JSON.stringify(body, null, 2).slice(0, 6000)}`);
      return body as unknown;
    } catch (e) {
      setOut(`Request failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const loadCode = async () => {
    const res = await fetch(`${API_BASE_URL}/borrowers/giorgi/shares`);
    const shares = (await res.json()) as { code: string; lenderId: string; status: string }[];
    const s = shares.find((x) => x.lenderId === "city-bank" && x.status === "active");
    if (s) setCode(s.code);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try it — live</CardTitle>
        <CardDescription>
          These calls hit the real backend with the demo City Bank key <code className="font-mono">{LENDER_API_KEY}</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="try-code">Share code</Label>
            <Input id="try-code" className="w-44 font-mono" placeholder="TL-XXXX-1234" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button variant="outline" onClick={loadCode}>
            Use Giorgi&apos;s code
          </Button>
          <Button onClick={() => run("/reports", { method: "POST", body: JSON.stringify({ shareCode: code }) })} disabled={busy || !code}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />} POST /reports
          </Button>
          <Button variant="outline" onClick={() => run("/lender/applicants")} disabled={busy}>
            GET /lender/applicants
          </Button>
          <Button variant="outline" onClick={() => run("/lender/audit")} disabled={busy}>
            GET /lender/audit
          </Button>
        </div>
        {out && (
          <pre className="max-h-96 overflow-auto rounded-xl bg-[oklch(0.2_0.02_230)] p-4 font-mono text-xs text-[oklch(0.92_0.02_200)]" aria-live="polite">
            {out}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
