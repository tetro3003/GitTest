import type { IdentityCheck } from "@/lib/beta/types";
import { parseMrz } from "@/lib/beta/mrz";
import { samePerson } from "@/lib/beta/names";

export { mrzCheckDigit, parseMrz } from "@/lib/beta/mrz";

/**
 * Homemade ID check (no Sumsub). The browser photographs the ID and runs the
 * live selfie checks; the server re-checks everything it can prove by itself:
 * the machine-readable zone (MRZ) and its check digits, expiry, age and names.
 * Photos are never uploaded or stored, only the result.
 */

export interface IdSubmission {
  mrz: string;
  liveness: { blink: boolean; turn: boolean; realScore?: number };
  faceSimilarity: number;
}

export const FACE_MATCH_MIN = 0.55;

export function evaluateId(input: IdSubmission, ctx: { accountName: string; holderNames: { source: string; name: string }[]; now: Date }): IdentityCheck {
  const checks: IdentityCheck["checks"] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) => checks.push({ id, label, ok, detail });
  const m = parseMrz(input.mrz);
  add("mrz", "ID code readable", !!m, m ? `${m.format === "TD1" ? "ID card" : "Passport"} · ${m.country}` : "The code on the ID must be 3 lines of 30 or 2 lines of 44 characters");
  if (m) {
    const bad = m.checks.filter((c) => !c.ok);
    add("checksums", "Check digits correct", !bad.length, bad.length ? `Wrong: ${bad.map((c) => c.field).join(", ")}. The code was misread or altered.` : `${m.checks.length} check digits all match`);
    const expired = new Date(m.expiryDate) < ctx.now;
    add("expiry", "Not expired", !expired, `Valid until ${m.expiryDate}`);
    const age = (ctx.now.getTime() - new Date(m.birthDate).getTime()) / (365.25 * 864e5);
    add("age", "18 or older", age >= 18, `Age ${Math.floor(age)}`);
    const full = `${m.givenNames} ${m.surname}`;
    add("name", "Name matches your account", samePerson(full, ctx.accountName), `ID: ${full} · account: ${ctx.accountName}`);
    for (const h of ctx.holderNames) add(`holder_${h.source}`, `Same name at ${h.source}`, samePerson(full, h.name), `${h.source} account holder: ${h.name}`);
  }
  add("liveness", "Live person (blink + head turn)", input.liveness.blink && input.liveness.turn, `blink ${input.liveness.blink ? "✓" : "✗"} · head turn ${input.liveness.turn ? "✓" : "✗"}${input.liveness.realScore != null ? ` · real-face score ${input.liveness.realScore.toFixed(2)}` : ""}`);
  add("face", "Selfie matches ID photo", input.faceSimilarity >= FACE_MATCH_MIN, `similarity ${input.faceSimilarity.toFixed(2)} (needs ${FACE_MATCH_MIN})`);
  const verified = checks.every((c) => c.ok);
  return {
    status: verified ? "verified" : "failed",
    name: m ? `${m.givenNames} ${m.surname}` : "",
    documentNumberLast4: m ? m.documentNumber.slice(-4) : "",
    expiry: m?.expiryDate ?? "",
    checks,
    verifiedAt: ctx.now.toISOString(),
  };
}
