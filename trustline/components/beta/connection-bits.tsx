"use client";

import { Check, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BetaConnection } from "@/lib/beta/types";

export function StatusBadge({ c }: { c: BetaConnection }) {
  if (c.status === "syncing") return <Badge variant="default"><Loader2 className="animate-spin" /> Reading…</Badge>;
  if (c.status === "error") return <Badge variant="risk"><TriangleAlert /> Problem</Badge>;
  if (c.status === "needs_setup") return <Badge variant="warning">Needs setup</Badge>;
  return <Badge variant="positive"><Check /> Connected</Badge>;
}

export function lastSync(c: BetaConnection) {
  if (!c.lastSyncAt) return "Not read yet";
  const mins = Math.round((Date.now() - new Date(c.lastSyncAt).getTime()) / 60000);
  return `Last read ${mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`} · the robot re-reads daily`;
}

export function ConnectionActions({ c, onSync, onDisconnect }: { c: BetaConnection; onSync: () => void; onDisconnect: () => void }) {
  return (
    <div className="flex gap-1">
      {c.status !== "needs_setup" && (
        <Button size="sm" variant="ghost" className="rounded-xl" onClick={onSync} disabled={c.status === "syncing"} aria-label={`Refresh ${c.label}`}>
          <RefreshCw /> Refresh
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl text-muted-foreground hover:text-risk"
        onClick={() => {
          if (confirm(`Disconnect ${c.label}? Its key and everything read from it will be deleted.`)) onDisconnect();
        }}
        aria-label={`Disconnect ${c.label}`}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
