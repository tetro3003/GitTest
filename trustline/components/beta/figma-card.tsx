"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { betaApi } from "@/lib/beta/client";
import type { BetaConnection } from "@/lib/beta/types";
import { FigmaMark } from "./brand-icons";
import { ConnectionActions, lastSync, StatusBadge } from "./connection-bits";

export function FigmaCard({ connection, oauth, onChange, onError }: { connection: BetaConnection | null; oauth: boolean; onChange: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(!oauth);
  const [files, setFiles] = useState(((connection?.settings.files as string[] | undefined) ?? []).join("\n"));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = () =>
    run(async () => {
      const { url } = await betaApi.figmaStart();
      window.location.href = url;
    });

  const saveToken = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get("token") ?? "");
    void run(() => betaApi.figmaToken(token));
  };

  const saveFiles = () => run(() => betaApi.setFiles(connection!.id, files.split(/\s+/).filter(Boolean)));

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5"><FigmaMark className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{connection?.label ?? "Figma"}</p>
            {connection && <StatusBadge c={connection} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {connection ? `${connection.stats.workItems} work facts · ${lastSync(connection)}` : "Version history and client comments on the files you choose. Read-only."}
          </p>
          {connection?.lastError && <p className="mt-1 text-sm text-risk">{connection.lastError}</p>}
        </div>
        {connection && <ConnectionActions c={connection} onSync={() => run(() => betaApi.sync(connection.id))} onDisconnect={() => run(() => betaApi.disconnect(connection.id))} />}
      </div>

      {!connection && (
        <div className="mt-4 space-y-3">
          {oauth && (
            <Button onClick={signIn} disabled={busy} size="lg" className="w-full rounded-xl bg-neutral-950 text-white shadow-lg hover:bg-neutral-800 sm:w-auto dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">
              {busy ? <Loader2 className="animate-spin" /> : <FigmaMark className="size-4" />} Sign in with Figma
            </Button>
          )}
          {oauth && !showToken && (
            <button className="block text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setShowToken(true)}>
              Or use a personal access token
            </button>
          )}
          {showToken && (
            <form onSubmit={saveToken} className="space-y-2 rounded-2xl border border-dashed bg-background/50 p-4">
              <p className="text-sm">
                {!oauth && <><strong>“Sign in with Figma” isn&apos;t set up on this server yet.</strong> Until then, use a personal token: </>}
                Figma → your avatar → <strong>Settings → Security → Personal access tokens</strong> → Generate. Tick <em>read</em> for File content, File versions and Comments (current user too, if shown).
              </p>
              <Label htmlFor="figma-token">Personal access token</Label>
              <div className="flex gap-2">
                <Input id="figma-token" name="token" type="password" autoComplete="off" placeholder="figd_…" required />
                <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Connect"}</Button>
              </div>
              <p className="text-xs text-muted-foreground">It&apos;s encrypted in our vault and only used to read. Delete it in Figma any time to cut access.</p>
            </form>
          )}
        </div>
      )}

      {connection && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="figma-files">Files that hold client work (one link per line)</Label>
          <textarea
            id="figma-files"
            value={files}
            onChange={(e) => setFiles(e.target.value)}
            rows={3}
            placeholder="https://www.figma.com/design/AbC123…/Client-app"
            className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 font-mono text-xs focus-visible:outline-2 focus-visible:outline-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              In Figma: open the file → <strong>Share → Copy link</strong>. Only these files are read. <ExternalLink className="size-3" />
            </p>
            <Button size="sm" onClick={saveFiles} disabled={busy || !files.trim()}>
              {busy && <Loader2 className="animate-spin" />} Save and read files
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
