"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const STEPS = [
  "Fetching transactions",
  "Categorizing 1,000+ transactions",
  "Calculating verified income",
  "Checking work activity",
  "Running fraud & consistency checks",
  "Scoring",
];

export default function Analyzing() {
  const router = useRouter();
  const personaId = useDemo((s) => s.personaId);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = STEPS.map((_, i) => setTimeout(() => !cancelled && setDone((d) => Math.max(d, i + 1)), 650 * (i + 1)));
    const profile = api.getProfile(personaId);
    Promise.all([profile, new Promise((r) => setTimeout(r, 650 * STEPS.length + 400))])
      .then(() => !cancelled && router.replace("/borrower/profile"))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [personaId, router]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-10 text-center">
      <div className="relative mb-8 flex size-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
        <span className="relative flex size-20 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Loader2 className="size-8 animate-spin" />
        </span>
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Building your profile</h1>
      <p className="mt-1 text-muted-foreground">This usually takes a few seconds.</p>
      <Progress value={(done / STEPS.length) * 100} className="mt-6" label="Analysis progress" />
      <ol className="mt-6 w-full space-y-2 text-left" aria-live="polite">
        {STEPS.map((s, i) => {
          const state = i < done ? "done" : i === done ? "active" : "todo";
          return (
            <li key={s} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", state === "active" && "bg-brand-soft")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full", state === "done" ? "bg-positive text-white" : state === "active" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                {state === "done" ? <Check className="size-3.5" /> : state === "active" ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-xs">{i + 1}</span>}
              </span>
              <span className={cn(state === "todo" && "text-muted-foreground")}>{s}</span>
            </li>
          );
        })}
      </ol>
      {failed && (
        <p className="mt-6 text-sm text-risk" role="alert">
          Something went wrong.{" "}
          <button className="underline" onClick={() => router.refresh()}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
