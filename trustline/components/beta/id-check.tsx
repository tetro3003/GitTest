"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, ScanFace, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { betaApi } from "@/lib/beta/client";
import { faceSimilarity, loadHuman, ocrMrz, readFace, snapshot, startCamera, stopCamera } from "@/lib/beta/id-capture";
import { parseMrz } from "@/lib/beta/mrz";
import type { IdentityCheck } from "@/lib/beta/types";
import { cn } from "@/lib/utils";

type Step = "intro" | "back" | "front" | "selfie" | "result";

export function IdCheckCard({ identity, onChange }: { identity: IdentityCheck | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const ok = identity?.status === "verified";
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg", ok ? "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/25" : "bg-gradient-to-br from-slate-500 to-slate-700")}>
          {ok ? <ShieldCheck className="size-6" /> : <ScanFace className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">ID check</p>
          <p className="text-sm text-muted-foreground">
            {ok ? `Verified: ${identity!.name} · document …${identity!.documentNumberLast4} · valid until ${identity!.expiry}` : "Photograph your ID card or passport and take a live selfie. Photos never leave your device."}
          </p>
        </div>
        <Button size="sm" className="rounded-xl" variant={ok ? "outline" : "default"} onClick={() => setOpen(true)}>
          {ok ? "Redo" : "Start"}
        </Button>
      </div>
      {identity && (
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {identity.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs" title={c.detail}>
              {c.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-positive" /> : <X className="mt-0.5 size-3.5 shrink-0 text-risk" />}
              <span><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">· {c.detail}</span></span>
            </li>
          ))}
        </ul>
      )}
      {open && <IdCheckDialog onClose={() => setOpen(false)} onDone={onChange} />}
    </div>
  );
}

function IdCheckDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>("intro");
  const [doc, setDoc] = useState<"id" | "passport">("id");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mrz, setMrz] = useState("");
  const [idFace, setIdFace] = useState<number[] | null>(null);
  const [live, setLive] = useState({ blink: false, turn: false, real: 0, similarity: 0, selfie: null as number[] | null });
  const [result, setResult] = useState<IdentityCheck | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const loop = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (loop.current) cancelAnimationFrame(loop.current);
    loop.current = null;
    stopCamera(stream.current);
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    void loadHuman().catch(() => {}); // start downloading face models early
  }, []);

  const camera = async (facing: "user" | "environment") => {
    stop();
    setError(null);
    try {
      stream.current = await startCamera(video.current!, facing);
    } catch {
      setError("Camera unavailable. Allow camera access in the browser and try again.");
    }
  };

  const go = (s: Step) => {
    setStep(s);
    if (s === "back" || s === "front") void camera("environment");
    if (s === "selfie") void camera("user").then(runSelfie);
    if (s === "result" || s === "intro") stop();
  };

  const captureBack = async () => {
    setBusy("Reading the code on your document… 0%");
    setError(null);
    try {
      const shot = snapshot(video.current!);
      const text = await ocrMrz(shot, (p) => setBusy(`Reading the code on your document… ${Math.round(p * 100)}%`));
      setMrz(text);
      if (!text) setError(`Couldn't find the code lines. Fill the frame with the ${doc === "passport" ? "passport photo page" : "back of the card"}, avoid glare, and try again. You can also type them.`);
      if (doc === "passport") {
        // A passport's photo page holds both the code and the photo: one picture does both.
        setBusy("Finding the face on your passport…");
        const f = await readFace(shot);
        setIdFace(f?.embedding ?? null);
        if (!f?.embedding) setError("No clear face found on the photo page. Hold it closer, avoid glare, and retake.");
      }
    } catch (e) {
      setError(`Reading failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const captureFront = async () => {
    setBusy("Finding the face on your ID…");
    setError(null);
    try {
      const f = await readFace(snapshot(video.current!));
      if (!f?.embedding) setError("No clear face found on the ID. Hold it closer, avoid glare, and retake.");
      else {
        setIdFace(f.embedding);
        go("selfie");
      }
    } catch (e) {
      setError(`Face reading failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const runSelfie = () => {
    const state = { blink: false, turn: false, real: 0, selfie: null as number[] | null, last: 0 };
    const tick = async (t: number) => {
      if (!video.current || !stream.current) return;
      if (t - state.last > 120) {
        state.last = t;
        const f = await readFace(video.current).catch(() => null);
        if (f) {
          if (f.gestures.some((g) => g.startsWith("blink"))) state.blink = true;
          if (state.blink && (Math.abs(f.yaw) > 0.3 || f.gestures.some((g) => g === "facing left" || g === "facing right"))) state.turn = true;
          if (Math.abs(f.yaw) < 0.15 && f.embedding) state.selfie = f.embedding;
          if (f.real != null) state.real = Math.max(state.real, f.real);
          setLive((l) => ({ ...l, blink: state.blink, turn: state.turn, real: state.real, selfie: state.selfie }));
        }
        if (state.blink && state.turn && state.selfie) {
          stop();
          return;
        }
      }
      loop.current = requestAnimationFrame(tick);
    };
    loop.current = requestAnimationFrame(tick);
  };

  const submit = async () => {
    setBusy("Checking on our server…");
    setError(null);
    try {
      const similarity = idFace && live.selfie ? await faceSimilarity(idFace, live.selfie) : 0;
      const r = await betaApi.verifyIdentity({ mrz, liveness: { blink: live.blink, turn: live.turn, realScore: live.real || undefined }, faceSimilarity: similarity });
      setResult(r.identity);
      go("result");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const parsed = mrz ? parseMrz(mrz) : null;
  const allOk = parsed?.checks.every((c) => c.ok);
  const showVideo = step === "back" || step === "front" || (step === "selfie" && !(live.blink && live.turn && live.selfie));
  const STEPS: Step[] = doc === "passport" ? ["back", "selfie", "result"] : ["back", "front", "selfie", "result"];
  const LABELS = doc === "passport" ? ["Photo page", "Live selfie", "Result"] : ["Back of ID", "Front", "Live selfie", "Result"];

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && (stop(), onClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogTitle>Check your ID</DialogTitle>
        <DialogDescription>Runs on your device. Photos are never uploaded or stored; only the results are sent.</DialogDescription>

        <ol className={cn("mt-4 grid gap-1", doc === "passport" ? "grid-cols-3" : "grid-cols-4")} aria-label="Progress">
          {LABELS.map((l, i) => (
            <li key={l} className={cn("rounded-full py-1 text-center text-[11px] font-semibold", STEPS.indexOf(step) >= i ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>{l}</li>
          ))}
        </ol>

        {step === "intro" && (
          <div className="mt-5 space-y-3 text-sm">
            <fieldset>
              <legend className="mb-2 font-medium">Which document?</legend>
              <div className="grid grid-cols-2 gap-2">
                {([["id", "ID card", "Georgian or any ICAO ID card"], ["passport", "Passport", "Any country"]] as const).map(([v, t, sub]) => (
                  <label key={v} className={cn("cursor-pointer rounded-2xl border p-3", doc === v ? "border-brand bg-brand-soft/60" : "hover:bg-muted/60")}>
                    <input type="radio" name="doc" className="sr-only" checked={doc === v} onChange={() => setDoc(v)} />
                    <span className="block font-semibold">{t}</span>
                    <span className="block text-xs text-muted-foreground">{sub}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              {doc === "id" ? (
                <>
                  <li>Photograph the <strong>back</strong>: we read the code lines (with <code>&lt;&lt;&lt;</code>) and check their built-in check digits.</li>
                  <li>Photograph the <strong>front</strong>: we find the face on the card.</li>
                </>
              ) : (
                <li>Photograph the <strong>photo page</strong>: we read the two code lines at the bottom (with <code>&lt;&lt;&lt;</code>), check their digits, and find your photo.</li>
              )}
              <li>Take a <strong>live selfie</strong>: blink, then turn your head. We compare your face with the document.</li>
            </ol>
            <p className="rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <strong>Why not a driver&apos;s licence?</strong> Licences don&apos;t carry the machine-readable code with check digits, so an edited number couldn&apos;t be caught. Georgian banks also ask for an ID card or passport for identity checks.
            </p>
            <p className="text-xs text-muted-foreground">First use downloads the reading and face models (~15 MB).</p>
            <Button className="w-full rounded-xl" onClick={() => go("back")}><Camera /> Start</Button>
          </div>
        )}

        <div className={cn("relative mt-4 overflow-hidden rounded-2xl bg-black", !showVideo && "hidden")}>
          <video ref={video} playsInline muted className={cn("aspect-video w-full object-cover", step === "selfie" && "-scale-x-100")} />
          {(step === "back" || step === "front") && <div className="pointer-events-none absolute inset-[10%] rounded-xl border-2 border-dashed border-white/70" />}
          {step === "selfie" && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-3 text-center text-sm font-semibold text-white">
              {!live.blink ? "Look at the camera and blink" : !live.turn ? "Now turn your head to one side" : "Look straight at the camera"}
            </div>
          )}
        </div>

        {step === "back" && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" onClick={captureBack} disabled={!!busy}>{busy ? <Loader2 className="animate-spin" /> : <Camera />} {doc === "passport" ? "Capture photo page" : "Capture back of ID"}</Button>
            </div>
            <label className="block text-xs font-medium" htmlFor="mrz">Code lines (fix any misread character)</label>
            <textarea id="mrz" value={mrz} onChange={(e) => setMrz(e.target.value.toUpperCase())} rows={doc === "passport" ? 2 : 3} spellCheck={false} className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 font-mono text-xs tracking-wider" placeholder={doc === "passport" ? "P<GEO…" : "IDGEO…"} />
            {parsed && (
              <p className={cn("text-xs", allOk ? "text-positive" : "text-risk")}>
                {allOk ? `✓ ${parsed.givenNames} ${parsed.surname} · all check digits correct` : `Check digits wrong: ${parsed.checks.filter((c) => !c.ok).map((c) => c.field).join(", ")}. Retake or fix the characters.`}
              </p>
            )}
            {mrz && !parsed && <p className="text-xs text-risk">Needs 3 lines of 30 characters (ID card) or 2 of 44 (passport).</p>}
            {doc === "passport" ? (
              <Button className="w-full rounded-xl" variant="outline" disabled={!allOk || !idFace || !!busy} onClick={() => go("selfie")}>Next: live selfie</Button>
            ) : (
              <Button className="w-full rounded-xl" variant="outline" disabled={!allOk || !!busy} onClick={() => go("front")}>Next: front of ID</Button>
            )}
          </div>
        )}

        {step === "front" && (
          <Button className="mt-3 w-full rounded-xl" onClick={captureFront} disabled={!!busy}>{busy ? <Loader2 className="animate-spin" /> : <Camera />} Capture front of ID</Button>
        )}

        {step === "selfie" && (
          <div className="mt-3 space-y-2">
            <ul className="grid grid-cols-3 gap-2 text-center text-xs">
              {[["Blink", live.blink], ["Head turn", live.turn], ["Face captured", !!live.selfie]].map(([l, done]) => (
                <li key={String(l)} className={cn("rounded-xl border p-2", done ? "border-positive bg-positive-soft text-positive" : "text-muted-foreground")}>{done ? "✓ " : ""}{l}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => { setLive({ blink: false, turn: false, real: 0, similarity: 0, selfie: null }); go("selfie"); }}><RotateCcw /> Restart</Button>
              <Button className="flex-1 rounded-xl" disabled={!(live.blink && live.turn && live.selfie) || !!busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Check my ID</Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="mt-4 space-y-3">
            <p className={cn("rounded-2xl p-3 text-sm font-semibold", result.status === "verified" ? "bg-positive-soft text-positive" : "bg-risk-soft text-risk")}>
              {result.status === "verified" ? `Verified: ${result.name}` : "Not verified. See what failed below."}
            </p>
            <ul className="space-y-1.5 text-sm">
              {result.checks.map((c) => (
                <li key={c.id} className="flex gap-2">{c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-positive" /> : <X className="mt-0.5 size-4 shrink-0 text-risk" />}<span><strong>{c.label}</strong> <span className="text-muted-foreground">· {c.detail}</span></span></li>
              ))}
            </ul>
            <Button className="w-full rounded-xl" onClick={onClose}>Done</Button>
          </div>
        )}

        {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {busy}</p>}
        {error && <p className="mt-3 rounded-xl bg-risk-soft p-3 text-sm text-risk" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
