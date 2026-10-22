/**
 * Machine-readable zone (MRZ) of ID cards (3 lines × 30) and passports (2 lines × 44).
 * Each key field carries a check digit, so a misread or altered character is caught.
 * Shared by the browser (live feedback while scanning) and the server (final check).
 */

const VAL = (c: string) => (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);
export function mrzCheckDigit(s: string): number {
  const w = [7, 3, 1];
  return [...s].reduce((sum, c, i) => sum + VAL(c) * w[i % 3], 0) % 10;
}

export interface Mrz {
  format: "TD1" | "TD3";
  documentNumber: string;
  country: string;
  nationality: string;
  birthDate: string;
  expiryDate: string;
  sex: string;
  surname: string;
  givenNames: string;
  personalNumber: string;
  checks: { field: string; ok: boolean }[];
}

const yymmdd = (s: string, future: boolean) => {
  const yy = Number(s.slice(0, 2));
  const now = new Date().getUTCFullYear() % 100;
  const century = future ? 2000 : yy > now ? 1900 : 2000;
  return `${century + yy}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
};
const names = (s: string) => {
  const [sur, given = ""] = s.split("<<");
  return { surname: sur.replace(/</g, " ").trim(), givenNames: given.replace(/</g, " ").trim() };
};
const clean = (s: string) => s.replace(/<+$/, "").replace(/</g, "");

/** Parses ID-card (3×30) or passport (2×44) MRZ text. Returns null when the shape is wrong. */
export function parseMrz(text: string): Mrz | null {
  const lines = text.toUpperCase().replace(/[ \t]/g, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ok = (data: string, digit: string) => /\d/.test(digit) && mrzCheckDigit(data) === Number(digit);
  if (lines.length === 3 && lines.every((l) => l.length === 30)) {
    const [a, b, c] = lines;
    const n = names(c);
    const optional = a.slice(15, 30) + b.slice(18, 29);
    return {
      format: "TD1",
      documentNumber: clean(a.slice(5, 14)),
      country: clean(a.slice(2, 5)),
      nationality: clean(b.slice(15, 18)),
      birthDate: yymmdd(b.slice(0, 6), false),
      expiryDate: yymmdd(b.slice(8, 14), true),
      sex: b[7],
      ...n,
      personalNumber: optional.match(/\d{11}/)?.[0] ?? clean(optional),
      checks: [
        { field: "document number", ok: ok(a.slice(5, 14), a[14]) },
        { field: "birth date", ok: ok(b.slice(0, 6), b[6]) },
        { field: "expiry date", ok: ok(b.slice(8, 14), b[14]) },
        { field: "whole code", ok: ok(a.slice(5, 30) + b.slice(0, 7) + b.slice(8, 15) + b.slice(18, 29), b[29]) },
      ],
    };
  }
  if (lines.length === 2 && lines.every((l) => l.length === 44)) {
    const [a, b] = lines;
    const n = names(a.slice(5));
    return {
      format: "TD3",
      documentNumber: clean(b.slice(0, 9)),
      country: clean(a.slice(2, 5)),
      nationality: clean(b.slice(10, 13)),
      birthDate: yymmdd(b.slice(13, 19), false),
      expiryDate: yymmdd(b.slice(21, 27), true),
      sex: b[20],
      ...n,
      personalNumber: clean(b.slice(28, 42)),
      checks: [
        { field: "document number", ok: ok(b.slice(0, 9), b[9]) },
        { field: "birth date", ok: ok(b.slice(13, 19), b[19]) },
        { field: "expiry date", ok: ok(b.slice(21, 27), b[27]) },
        { field: "personal number", ok: b[42] === "<" ? /^<*$/.test(b.slice(28, 42)) : ok(b.slice(28, 42), b[42]) },
        { field: "whole code", ok: ok(b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43), b[43]) },
      ],
    };
  }
  return null;
}

/** Pulls MRZ-looking lines out of OCR text and normalises common OCR slips. */
export function mrzFromOcr(text: string): string {
  const lines = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, "").replace(/[«‹]/g, "<").replace(/[^A-Z0-9<]/g, ""))
    .filter((l) => l.length >= 25 && (l.includes("<") || /\d{6}/.test(l)));
  const width = lines.some((l) => l.length > 36) ? 44 : 30;
  return lines
    .slice(-(width === 44 ? 2 : 3))
    .map((l) => (l.length > width ? l.slice(0, width) : l.padEnd(width, "<")))
    .join("\n");
}
