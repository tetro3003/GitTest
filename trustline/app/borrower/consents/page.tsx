"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Database, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { SOURCE_TYPE_LABEL } from "@/lib/mock/sources";
import { useDemo } from "@/lib/store";

export default function Consents() {
  const { personaId, invalidate } = useDemo();
  const borrower = useApi(() => api.getBorrower(personaId), [personaId]);
  const shares = useApi(() => api.listShares(personaId), [personaId]);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      invalidate();
    } finally {
      setBusy(null);
    }
  };

  const sources = borrower.data?.connectedSources.filter((s) => s.connectedAt) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My data & consents</h1>
        <p className="mt-1 text-muted-foreground">Everything you&apos;ve connected or shared. Revoking takes effect immediately.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-brand" /> Connected sources
          </CardTitle>
          <CardDescription>Read-only connections used to build your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {borrower.error && <ErrorState error={borrower.error} onRetry={borrower.reload} />}
          {borrower.loading && !borrower.data && <CardSkeleton lines={2} />}
          {borrower.data && !sources.length && (
            <EmptyState title="Nothing connected" description="Connect a source to get started." action={<Button asChild size="sm"><Link href="/borrower/connect">Connect sources</Link></Button>} />
          )}
          <ul className="divide-y">
            {sources.map((s) => {
              const consent = borrower.data?.consents.find((c) => c.targetId === s.id);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {s.provider} <span className="text-sm font-normal text-muted-foreground">· {SOURCE_TYPE_LABEL[s.type]}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "connected" && consent ? `Since ${formatDate(consent.grantedAt)} · expires ${formatDate(consent.expiresAt)}` : "Access revoked"}
                    </p>
                  </div>
                  {s.status === "connected" ? (
                    <Button variant="outline" size="sm" onClick={() => act(s.id, () => api.disconnectSource(personaId, s.id))} disabled={busy === s.id} aria-label={`Revoke ${s.provider}`}>
                      {busy === s.id && <Loader2 className="animate-spin" />} Revoke
                    </Button>
                  ) : (
                    <Badge variant="muted">Revoked</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-brand" /> Shared with lenders
          </CardTitle>
          <CardDescription>Lenders who can currently see your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {shares.error && <ErrorState error={shares.error} onRetry={shares.reload} />}
          {shares.loading && !shares.data && <CardSkeleton lines={2} />}
          {shares.data && !shares.data.length && (
            <EmptyState title="Not shared yet" description="Your profile is private until you share it." action={<Button asChild size="sm"><Link href="/borrower/share">Share with a lender</Link></Button>} />
          )}
          <ul className="divide-y">
            {shares.data?.map((sh) => (
              <li key={sh.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {sh.lenderName} <span className="font-mono text-xs text-muted-foreground">{sh.code}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sh.scope.join(", ")} · until {formatDate(sh.expiresAt)}
                  </p>
                </div>
                {sh.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={() => act(sh.id, () => api.revokeShare(personaId, sh.id))} disabled={busy === sh.id} aria-label={`Revoke access for ${sh.lenderName}`}>
                    {busy === sh.id && <Loader2 className="animate-spin" />} Revoke
                  </Button>
                ) : (
                  <Badge variant="muted" className="capitalize">{sh.status}</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
