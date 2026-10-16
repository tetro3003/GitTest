"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileUp, Loader2, Lock, Monitor, PlugZap, Sparkles, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ImportResult, IngestSetup } from "@/lib/api/client";
import { API_MODE, SAMPLES_BASE } from "@/lib/config";
import { CHANNEL_LABEL, sourceDefFor } from "@/lib/checker/profiles";
import { formatDate, formatMoney } from "@/lib/format";
import { useDemo } from "@/lib/store";
import type { DataSource, EvidenceChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Sample export files you can download to try the upload (public/samples). */
export const SAMPLE_FILES: Record<string, string> = {
  "Bolt Driver": "bolt-earnings-sample.csv",
  "Uber Driver": "bolt-earnings-sample.csv",
  "Wolt Partner": "wolt-shifts-sample.csv",
  "Glovo Courier": "wolt-shifts-sample.csv",
  Booksy: "booksy-appointments-sample.csv",
  Fresha: "booksy-appointments-sample.csv",
  Zoom: "zoom-meetings-sample.csv",
  "Google Meet": "zoom-meetings-sample.csv",
  Figma: "toggl-figma-sample.csv",
  "Adobe Photoshop": "toggl-figma-sample.csv",
  "Adobe Illustrator": "toggl-figma-sample.csv",
  Jira: "jira-worklog-sample.csv",
  GitHub: "jira-worklog-sample.csv",
};

const ICON: Record<EvidenceChannel, typeof FileUp> = { file: FileUp, api: PlugZap, webhook: Webhook, tracker: Monitor, upload: FileUp, simulated: Sparkles };

/**
 * The universal "add work data" sheet: every app gets the doors it supports —
 * upload an export, sign in (API), live webhook (Zapier/Make/sensors) or the
 * desktop tracker — plus demo data.
 */
export function WorkDataSheet({ source, onClose }: { source: DataSource | null; onClose: () => void }) {
  const def = source ? sourceDefFor(source.provider, source.type) : undefined;
  const channels = (def?.channels ?? ["file"]).filter((c) => c !== "upload");
  const [tab, setTab] = useState<EvidenceChannel | "demo">("file");

  useEffect(() => {
    if (source) setTab(channels[0] ?? "demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id]);

  return (
    <Dialog open={!!source} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {source && (
          <div className="space-y-4">
            <div>
              <DialogTitle>Add work data · {source.provider}</DialogTitle>
              <DialogDescription>{def?.how}</DialogDescription>
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="How to add data">
              {[...channels, "demo" as const].map((c) => {
                const Icon = c === "demo" ? Sparkles : ICON[c];
                return (
                  <button
                    key={c}
                    role="tab"
                    aria-selected={tab === c}
                    onClick={() => setTab(c)}
                    className={cn("flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium", tab === c ? "bg-card shadow-sm" : "text-muted-foreground")}
                  >
                    <Icon className="size-3.5" /> {c === "demo" ? "Demo data" : CHANNEL_LABEL[c]}
                  </button>
                );
              })}
            </div>
            {tab === "file" && <FileTab source={source} hint={def?.exportHint} />}
            {tab === "api" && <ApiTab source={source} onDone={onClose} />}
            {tab === "webhook" && <IngestTab source={source} kind="webhook" />}
            {tab === "tracker" && <IngestTab source={source} kind="tracker" />}
            {tab === "demo" && <DemoTab source={source} onDone={onClose} />}
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" /> Read-only. You choose what goes in and can disconnect anytime; disconnecting deletes the data.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FileTab({ source, hint }: { source: DataSource; hint?: string }) {
  const { personaId, invalidate } = useDemo();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const sample = SAMPLE_FILES[source.provider];

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const text = await file.text();
      setResult(await api.importWorkData(personaId, source.id, { name: file.name, text }));
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Download your work history from {source.provider}{hint ? <>: <span className="text-muted-foreground">{hint}</span></> : "."}</li>
        <li>Upload the CSV or JSON file here. We find the dates, durations, clients and earnings automatically.</li>
      </ol>
      <input ref={input} id={`file-${source.id}`} type="file" accept=".csv,.json,.txt,text/csv,application/json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Upload export file
        </Button>
        {sample && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const res = await fetch(`${SAMPLES_BASE}${sample}`);
                if (!res.ok) throw new Error("Couldn't load the sample file");
                setResult(await api.importWorkData(personaId, source.id, { name: sample, text: await res.text() }));
                invalidate();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sample import failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Sparkles /> Try a sample file
          </Button>
        )}
        {sample && API_MODE === "live" && (
          <Button asChild variant="ghost">
            <a href={`${SAMPLES_BASE}${sample}`} download>
              <Download /> Download sample
            </a>
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-risk">
          {error}
        </p>
      )}
      {result && <ImportReport result={result} />}
    </div>
  );
}

function ImportReport({ result }: { result: ImportResult }) {
  const s = result.summary;
  return (
    <div role="status" className="space-y-2 rounded-lg border border-positive/40 bg-positive-soft/60 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Check className="size-4 text-positive" /> Imported {s.imported.toLocaleString("en-US")} of {s.rows.toLocaleString("en-US")} rows from {s.fileName}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Period</dt>
        <dd>{s.from && s.to ? `${formatDate(s.from)} – ${formatDate(s.to)}` : "—"}</dd>
        <dt className="text-muted-foreground">Work time</dt>
        <dd>{s.hours.toLocaleString("en-US")} h</dd>
        {s.amount > 0 && (
          <>
            <dt className="text-muted-foreground">Earnings in file</dt>
            <dd>{formatMoney(s.amount)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Columns used</dt>
        <dd className="truncate" title={Object.entries(s.columns).map(([k, v]) => `${k}: ${v}`).join(", ")}>
          {Object.entries(s.columns).map(([k, v]) => `${k} = “${v}”`).join(", ")}
        </dd>
      </dl>
      {s.warnings.map((w) => (
        <p key={w} className="text-xs text-muted-foreground">
          • {w}
        </p>
      ))}
    </div>
  );
}

function ApiTab({ source, onDone }: { source: DataSource; onDone: () => void }) {
  const { personaId, invalidate } = useDemo();
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [files, setFiles] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isGitHub = source.provider === "GitHub";

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await api.connectSource(personaId, source.id, isGitHub ? { github: { username } } : { figma: { token, files: files.split(/\s+|,/).filter(Boolean) } });
      invalidate();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {API_MODE === "mock" && <p className="rounded-lg bg-warning-soft p-3 text-sm">Direct sign-in needs the backend. Run the app on your laptop (see the guide) to connect a real {source.provider} account.</p>}
      {isGitHub ? (
        <div className="space-y-1.5">
          <Label htmlFor="gh-user">GitHub username</Label>
          <Input id="gh-user" placeholder="e.g. torvalds" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          <p className="text-xs text-muted-foreground">We read public commit and pull-request dates from the last 6 months — never your code.</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="figma-token">Figma personal access token</Label>
            <Input id="figma-token" type="password" placeholder="figd_…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <p className="text-xs text-muted-foreground">Figma → Settings → Security → Personal access tokens (read-only scopes). Used once, never stored.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="figma-files">Links to the files to check</Label>
            <textarea
              id="figma-files"
              rows={3}
              placeholder="https://www.figma.com/design/…"
              value={files}
              onChange={(e) => setFiles(e.target.value)}
              className="w-full rounded-lg border border-input bg-card p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-risk">
          {error}
        </p>
      )}
      <Button onClick={connect} disabled={busy || (isGitHub ? !username : !token || !files)}>
        {busy && <Loader2 className="animate-spin" />} Connect and read my work
      </Button>
    </div>
  );
}

function IngestTab({ source, kind }: { source: DataSource; kind: "webhook" | "tracker" }) {
  const { personaId } = useDemo();
  const [info, setInfo] = useState<IngestSetup | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    api
      .getIngestSetup(personaId, source.id)
      .then((i) => !off && setInfo(i))
      .catch((e: unknown) => !off && setError(e instanceof Error ? e.message : "Couldn't load the setup"));
    return () => {
      off = true;
    };
  }, [personaId, source.id]);

  if (error) return <p className="rounded-lg bg-warning-soft p-3 text-sm">{error}</p>;
  if (!info)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Creating your private key…
      </p>
    );

  return kind === "webhook" ? (
    <div className="space-y-3 text-sm">
      <p>Send each finished job, trip, lesson or appointment to this private address. Works with Zapier, Make, IFTTT, salon sensors or any script.</p>
      <CopyField label="Webhook URL" value={info.webhookUrl} />
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">Set it up in Zapier (no code)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Create a Zap. Trigger: your work app (e.g. “New appointment in Booksy” or “New row in Google Sheets”).</li>
          <li>Action: <strong>Webhooks by Zapier → POST</strong>. Paste the URL above.</li>
          <li>Payload type JSON with fields <code>at</code> (date/time), <code>minutes</code>, <code>client</code>, <code>amount</code>.</li>
        </ol>
      </details>
      <CopyField label="Test it from a terminal" value={info.exampleCurl} mono />
    </div>
  ) : (
    <div className="space-y-3 text-sm">
      <p>
        For apps on your computer (like {source.provider.replace(/^Adobe /, "")}), the tracker counts the minutes you actively work in them. It only reads the app&apos;s name — no screenshots, no window titles, no keystrokes.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Open a terminal in the project folder.</li>
        <li>Run this command and leave the window open while you work:</li>
      </ol>
      <CopyField label="Command" value={info.trackerCommand} mono />
      <p className="text-xs text-muted-foreground">Tip: add <code>--once</code> to check that it can see the app in front. Your work time appears here every 5 minutes.</p>
    </div>
  );
}

function DemoTab({ source, onDone }: { source: DataSource; onDone: () => void }) {
  const { personaId, invalidate } = useDemo();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <p>Connect with the demo persona&apos;s simulated history (shaped like real {source.provider} data). Useful for trying the app without your own files.</p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.connectSource(personaId, source.id);
            invalidate();
            onDone();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Loader2 className="animate-spin" />} Use demo data
      </Button>
    </div>
  );
}

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <textarea ref={ref} readOnly rows={mono ? 3 : 1} value={value} className={cn("min-w-0 flex-1 resize-none rounded-lg border bg-muted/50 p-2 text-xs", mono && "font-mono")} onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="outline"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => setCopied(true),
              () => ref.current?.select(),
            );
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}
