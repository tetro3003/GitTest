"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bike, Car, Check, CreditCard, GraduationCap, Laptop, Loader2, ScanFace, Wrench, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/states";
import { api } from "@/lib/api";
import { WORK_TYPE_LABEL } from "@/lib/format";
import { getPersona } from "@/lib/mock/personas";
import { useDemo } from "@/lib/store";
import type { WorkType } from "@/lib/types";
import { cn } from "@/lib/utils";

const WORK_ICONS: Record<WorkType, typeof Car> = { taxi: Car, delivery: Bike, it_freelance: Laptop, tutor: GraduationCap, repair: Wrench, other: MoreHorizontal };
const STEP_LABELS = ["Your details", "Verify identity", "Your work"];

export default function Onboarding() {
  const router = useRouter();
  const { personaId, invalidate } = useDemo();
  const persona = getPersona(personaId);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [workType, setWorkType] = useState<WorkType>("taxi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [kyc, setKyc] = useState<"idle" | "id" | "selfie" | "verifying" | "done">("idle");

  useEffect(() => {
    if (persona) {
      setName(persona.borrower.name);
      setPhone(persona.borrower.phone);
      setWorkType(persona.borrower.workType);
    }
  }, [persona]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const submitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.startOnboarding(personaId, { name, phone });
      invalidate();
      setStep(1);
    });
  };

  const verify = () =>
    run(async () => {
      setKyc("verifying");
      await api.submitKyc(personaId);
      setKyc("done");
    });

  const finish = () =>
    run(async () => {
      await api.setWorkType(personaId, workType);
      invalidate();
      router.push("/borrower/connect");
    });

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of 3 · {STEP_LABELS[step]}
        </p>
        <Progress value={((step + 1) / 3) * 100} className="mt-2" label="Onboarding progress" />
      </div>

      {error && <ErrorState error={error} onRetry={() => setError(undefined)} className="mb-4" />}

      {step === 0 && (
        <form onSubmit={submitDetails} className="space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Let&apos;s build your income profile</h1>
            <p className="mt-1 text-muted-foreground">It takes about 3 minutes. Nothing is shared with a lender until you say so.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name (as on your ID)</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" />
            <p className="text-xs text-muted-foreground">We&apos;ll send a one-time code (skipped in this demo).</p>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null} Continue <ArrowRight />
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Verify your identity</h1>
            <p className="mt-1 text-muted-foreground">A photo of your ID and a quick selfie. Required by lenders by law.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "id" as const, icon: CreditCard, label: "ID card photo", done: kyc !== "idle" },
              { key: "selfie" as const, icon: ScanFace, label: "Selfie", done: kyc === "selfie" || kyc === "verifying" || kyc === "done" },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={kyc === "verifying" || kyc === "done" || (c.key === "selfie" && kyc === "idle")}
                onClick={() => setKyc(c.key)}
                className={cn(
                  "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm transition-colors disabled:cursor-not-allowed",
                  c.done ? "border-positive bg-positive-soft text-positive" : "hover:border-brand hover:bg-brand-soft",
                )}
              >
                {c.done ? <Check className="size-6" /> : <c.icon className="size-6 text-muted-foreground" />}
                {c.done ? `${c.label} added` : `Add ${c.label.toLowerCase()}`}
              </button>
            ))}
          </div>

          {kyc === "verifying" && (
            <Card className="flex items-center gap-3 p-4" aria-live="polite">
              <Loader2 className="size-5 animate-spin text-brand" />
              <div className="text-sm">
                <p className="font-medium">Verifying…</p>
                <p className="text-muted-foreground">Checking document authenticity and matching your face.</p>
              </div>
            </Card>
          )}
          {kyc === "done" && (
            <Card className="flex items-center gap-3 border-positive/40 bg-positive-soft p-4" aria-live="polite">
              <Check className="size-5 text-positive" />
              <div className="text-sm">
                <p className="font-medium">Identity verified</p>
                <p className="text-muted-foreground">Name on ID: {persona?.borrower.name}</p>
              </div>
            </Card>
          )}

          {kyc === "done" ? (
            <Button size="lg" className="w-full" onClick={() => setStep(2)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" className="w-full" disabled={kyc !== "selfie" || busy} onClick={verify}>
              {busy && <Loader2 className="animate-spin" />} Verify identity
            </Button>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">What kind of work do you do?</h1>
            <p className="mt-1 text-muted-foreground">We compare your income with people doing similar work.</p>
          </div>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Work type">
            {(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((w) => {
              const Icon = WORK_ICONS[w];
              const active = workType === w;
              return (
                <button
                  key={w}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setWorkType(w)}
                  className={cn("flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium", active ? "border-brand bg-brand-soft" : "hover:bg-muted")}
                >
                  <Icon className={cn("size-5", active ? "text-brand" : "text-muted-foreground")} />
                  {WORK_TYPE_LABEL[w]}
                </button>
              );
            })}
          </div>
          <Button size="lg" className="w-full" onClick={finish} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Connect my income sources <ArrowRight />
          </Button>
        </div>
      )}
    </div>
  );
}
