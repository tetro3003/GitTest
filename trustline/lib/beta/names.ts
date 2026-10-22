/** Name helpers shared by the ID check, name matching and client matching. */

const KA: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i", კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q", შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

/** Lower-case Latin tokens; Georgian script is transliterated (national system), accents removed. */
export function nameTokens(name: string): string[] {
  const latin = [...name].map((c) => KA[c] ?? c).join("");
  return latin
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Same person: every token of the shorter name appears in the longer one (order-free), at least two tokens. */
export function samePerson(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length < 2) return short.length === 1 && long.length === 1 && short[0] === long[0];
  return short.every((t) => long.includes(t));
}

const GENERIC = new Set(["ltd", "llc", "inc", "gmbh", "the", "and", "app", "design", "studio", "team", "agency", "group", "company", "co", "pm", "client", "project", "website", "site", "web", "com", "ge", "io", "www", "new", "untitled", "draft", "final", "copy", "upwork", "fiverr", "paypal", "payoneer", "wise", "bank"]);

/** Looser: two names share a distinctive word (≥3 letters, not generic), e.g. “Bloom PM” and “Bloom Ltd”. */
export function shareDistinctiveWord(a: string, b: string): string | null {
  const ta = nameTokens(a).filter((t) => t.length >= 3 && !GENERIC.has(t));
  const tb = new Set(nameTokens(b).filter((t) => t.length >= 3 && !GENERIC.has(t)));
  return ta.find((t) => tb.has(t)) ?? null;
}
