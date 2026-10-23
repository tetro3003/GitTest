// Records the Trustline demo against `npm run demo`, paced by the voiceover clips in lines.json. See README.md.
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const B = process.env.DEMO_URL || "http://localhost:3100";
const STATEMENT = fileURLToPath(new URL("../../public/samples/tbc-test-transactions.csv", import.meta.url));
const W = 1440, H = 900;
const OUT = "video";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
const L = JSON.parse(readFileSync("lines.json", "utf8"));

const overlay = () => {
  const css = `
  #__cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1100px;z-index:2147483646;background:rgba(8,12,22,.92);color:#fff;font:600 22px/1.35 system-ui,sans-serif;padding:14px 22px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.14);text-align:center;transition:opacity .25s}
  #__cap:empty{opacity:0}
  #__tag{position:fixed;right:20px;top:84px;z-index:2147483646;background:#2DD4BF;color:#06231F;font:700 14px/1 ui-monospace,monospace;letter-spacing:1px;padding:8px 12px;border-radius:999px}
  #__tag:empty{display:none}
  #__card{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 20% 100%,#164B55 0%,#0A1220 62%);color:#EEF2F6;font-family:system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .35s}
  #__card.on{opacity:1}
  body:has(#__card.on) #__cur{opacity:0}
  #__card .k{font:700 18px ui-monospace,monospace;color:#2DD4BF;letter-spacing:3px;margin-bottom:18px}
  #__card h1{font-size:60px;line-height:1.05;margin:0 0 22px;letter-spacing:-1.5px}
  #__card p{font-size:26px;line-height:1.45;margin:8px 0;color:#C8D2DE}
  #__card .w{max-width:1050px;padding:0 40px}
  #__card .flag{display:inline-block;margin-top:22px;background:#F59E0B;color:#1F1300;font-weight:700;font-size:20px;padding:8px 14px;border-radius:10px}
  #__cur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid #0A1220;box-shadow:0 0 0 6px rgba(45,212,191,.35);pointer-events:none;transition:transform .12s;left:-50px;top:-50px}
  #__cur.down{transform:scale(.7)}
  nextjs-portal{display:none!important}`;
  const mount = () => {
    if (document.getElementById("__cap")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    for (const id of ["__cap", "__tag", "__card", "__cur"]) { const d = document.createElement("div"); d.id = id; document.body.appendChild(d); }
    const s = sessionStorage;
    document.getElementById("__cap").textContent = s.getItem("cap") || "";
    document.getElementById("__tag").textContent = s.getItem("tag") || "";
    const cur = document.getElementById("__cur");
    const xy = (s.getItem("cur") || "-50,-50").split(",");
    cur.style.left = xy[0] + "px"; cur.style.top = xy[1] + "px";
    addEventListener("mousemove", (e) => { cur.style.left = e.clientX + "px"; cur.style.top = e.clientY + "px"; s.setItem("cur", e.clientX + "," + e.clientY); }, true);
    addEventListener("mousedown", () => cur.classList.add("down"), true);
    addEventListener("mouseup", () => cur.classList.remove("down"), true);
  };
  window.__cap = (t) => { sessionStorage.setItem("cap", t); const e = document.getElementById("__cap"); if (e) e.textContent = t; };
  window.__tag = (t) => { sessionStorage.setItem("tag", t); const e = document.getElementById("__tag"); if (e) e.textContent = t; };
  window.__card = (html) => { const e = document.getElementById("__card"); if (!e) return; if (html) { e.innerHTML = `<div class="w">${html}</div>`; e.classList.add("on"); } else e.classList.remove("on"); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
};

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
{
  const c = await b.newContext(); const l = await c.newPage(); await l.goto(`${B}/beta`);
  console.log("lender", await l.evaluate(async () => (await fetch("/api/beta/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Ana Kvaratskhelia", email: "ana@citybank.demo", password: "password123", role: "lender", org: "City Bank" }) })).status));
  await c.close();
}
const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light", recordVideo: { dir: OUT, size: { width: W, height: H } } });
await ctx.addInitScript(overlay);
const p = await ctx.newPage();
const t0 = Date.now();
const T = () => ((Date.now() - t0) / 1000).toFixed(2);
const wait = (ms) => p.waitForTimeout(ms);
let voEnd = 0;
const voDone = async () => { const d = voEnd - Date.now(); if (d > 0) await wait(d + 250); };
/** Waits for the previous line to finish, then starts line `id` (caption + voice). */
const say = async (id) => {
  await voDone();
  console.log("CUE", id, T());
  await p.evaluate((t) => window.__cap(t), L[id].caption ?? "");
  voEnd = Date.now() + L[id].dur * 1000;
};
const tag = (t) => p.evaluate((t) => window.__tag(t), t);
/** Title card held for its voice line (or `min` ms). */
const card = async (id, html, min = 0) => {
  await voDone();
  console.log("CUE", id, T());
  await p.evaluate(() => window.__cap(""));
  await p.evaluate((h) => window.__card(h), html);
  voEnd = Date.now() + L[id].dur * 1000;
  await wait(Math.max(min, L[id].dur * 1000 + 500));
  await p.evaluate(() => window.__card(null));
  await wait(350);
};
const moveTo = async (loc) => {
  await loc.scrollIntoViewIfNeeded();
  const r = await loc.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 16 });
};
const click = async (loc, pause = 250) => { await moveTo(loc); await wait(pause); await loc.click(); };
const type = async (sel, text, delay = 25) => { await click(p.locator(sel)); await p.locator(sel).pressSequentially(text, { delay }); };
const scrollTo = async (loc, off = 110) => { await loc.evaluate((e, off) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" }), off); await wait(850); };
const glow = (loc, on = true) => loc.evaluate((e, on) => { e.style.outline = on ? "3px solid #F59E0B" : ""; e.style.outlineOffset = "3px"; e.style.borderRadius = "8px"; }, on);
const home = () => p.getByText("Hi Nino").waitFor();
const allow = async () => { await p.getByText("synthetic consent screen").waitFor(); await wait(700); await click(p.getByRole("button", { name: "Allow" })); };
const login = async (email) => {
  await click(p.getByRole("tab", { name: "Log in" }));
  await click(p.locator("#email")); await p.fill("#email", email); await p.fill("#password", "password123"); await wait(400);
  await click(p.getByRole("button", { name: "Log in" }).last());
};

// ---------- 0:00 Set the scene ----------
await p.goto(`${B}/beta`, { waitUntil: "networkidle" });
console.log("START", T());
await card("title", `<div class="k">TRUSTLINE · AI IN FINANCE</div><h1>Credit decisions for freelancers,<br>from verified income.</h1><p>Workflow: a bank officer deciding a loan for a freelancer.</p>`);
await card("persona", `<div class="k">PERSONA &amp; SCENARIO</div><h1>Nino Beridze, freelance product designer</h1><p>Paid through Upwork, PayPal, Wise and direct clients. No payslip. Applying for credit at City Bank.</p><p><b>This demo covers designers, our first beta group.</b> The same pipeline works for any freelancer: only the work sources change.</p><span class="flag">Nino, City Bank and Ana are fictional</span>`);
await tag("1 · SET THE SCENE");
await say("signup");
await type("#name", "Nino Beridze");
await type("#email", "nino@demo.ge");
await type("#password", "password123");
await click(p.getByRole("button", { name: "Create account" }).last());
await home();

// ---------- The input ----------
await tag("2 · THE INPUT · SYNTHETIC DATA");
await card("input", `<div class="k">THE INPUT</div><h1>Everything you will see is synthetic.</h1><p>Demo mode replaces every outside service with a local stand-in: Gmail, Figma, Wise, Canva, Webflow, Miro and TBC Bank.</p><p>The mailbox holds 15 fake payment emails from Upwork, PayPal and direct clients, and 1 forged “$9,000” email.</p><span class="flag">No real accounts, people or money</span>`);
await say("banner");
await moveTo(p.getByText(/DEMO MODE ·/));
await say("proofs");
await scrollTo(p.locator("#work-h"));
await moveTo(p.locator("#work-h"));
await wait(1200);
await scrollTo(p.locator("#money-h"));
await wait(1200);
await scrollTo(p.locator("#id-h"));
await wait(800);
await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await wait(700);

// ---------- The system at work ----------
await tag("3 · THE SYSTEM AT WORK · UNCUT");
await say("figma");
await click(p.getByRole("button", { name: "Sign in with Figma" }));
await allow();
await home();
await say("files");
await click(p.locator("#figma-files"));
await p.locator("#figma-files").pressSequentially("https://www.figma.com/design/BloomApp123456/Bloom\nhttps://www.figma.com/design/KaveaFlow98765/Kavea", { delay: 5 });
await click(p.getByRole("button", { name: "Save and read files" }));
const versions = p.getByText(/saved versions/).first();
await versions.waitFor();
await wait(1200);
await say("figdata");
await versions.evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "center" }));
await wait(500);
await glow(versions); await moveTo(versions);
await wait(2200);
const comments = p.getByText(/from other people/).first();
await comments.evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "center" }));
await glow(comments); await moveTo(comments);
await voDone();
await glow(versions, false); await glow(comments, false);
await say("gmail");
await click(p.getByRole("button", { name: "Connect Gmail" }).first());
await allow();
await home();
await say("wise");
await click(p.getByRole("button", { name: "Connect with a read-only token" }));
await click(p.locator("#tok-wise")); await p.fill("#tok-wise", "demo-wise-read-only-token-123456");
await click(p.locator("form:has(#tok-wise) button[type=submit]"));
await wait(1500);
await say("statement");
const up = p.getByRole("button", { name: /Upload statement/ });
await scrollTo(up, 300);
await moveTo(up);
await wait(1500);
await p.locator("input[type=file]").first().setInputFiles({ name: "tbc-statement-2026-10.csv", mimeType: "text/csv", buffer: readFileSync(STATEMENT) });
await p.getByText(/next statement due/).waitFor();
await moveTo(p.getByText(/next statement due/));
await say("bankid");
await click(p.getByRole("button", { name: "Confirm with TBC Bank" }));
await allow();
await home();
const holder = p.getByText(/BERIDZE NINO/).first();
await holder.waitFor();
await scrollTo(holder, 300);
await glow(holder); await moveTo(holder);
await voDone();
await glow(holder, false);
await say("forged");
const forged = p.getByText(/failed the signature check/).first();
await forged.evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "center" }));
await wait(500);
await glow(forged); await moveTo(forged);
await voDone();

// ---------- How the score works ----------
await tag("3 · HOW THE SCORE WORKS");
await say("score");
await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await wait(1800);
await scrollTo(p.locator("#why-h"), 90);
await moveTo(p.locator("#why-h"));
await say("factors");
const rows = p.locator("#why-h").locator("xpath=..").locator("li");
const n = await rows.count();
const each = Math.max(450, (L.factors.dur * 1000 - 500) / Math.max(1, n));
for (let i = 0; i < n; i++) {
  const r = rows.nth(i);
  if (/jump/i.test(await r.innerText())) continue;
  await glow(r); await moveTo(r); await wait(each - 200); await glow(r, false);
}
await say("flags");
await scrollTo(p.locator("#work-found-h"), 140);
const firstWork = p.locator("#work-found-h").locator("xpath=ancestor::section[1]").locator("li").first();
await glow(firstWork); await moveTo(firstWork);
await voDone();
await glow(firstWork, false);
await say("chart");
await scrollTo(p.locator("#chart-h"), 120);
await moveTo(p.locator("#chart-h"));
await voDone();
await say("share");
await scrollTo(p.locator("#share-h"));
await click(p.getByLabel("Choose a lender"));
await p.getByLabel("Choose a lender").selectOption({ label: "City Bank" });
await click(p.getByRole("button", { name: "Share my report" }));
await p.getByText("Waiting for review").waitFor();
await voDone();
await click(p.getByRole("button", { name: "Log out" }).first());

// ---------- AI evidence ----------
await tag("4 · AI EVIDENCE");
await card("evidence", `<div class="k">AI EVIDENCE</div><h1>The system suggests.<br>A person decides.</h1><p>The bank officer’s screen: reasoning, fallback and audit trail.</p>`, 3500);
await say("ana");
await login("ana@citybank.demo");
await p.getByRole("heading", { name: "Applicants" }).waitFor();
await click(p.getByText("Nino Beridze"));
await p.getByText("Explanation for the officer").waitFor();
const built = p.getByText(/Report built in/).first();
await moveTo(built);
const verified = Number((await p.getByText(/payments verified at source/).first().innerText()).match(/\d+/)[0]);
const ms = Number((await built.innerText()).match(/[\d.]+/)[0]);
const stmt = Number(((await p.getByText(/from bank statement/).first().innerText().catch(() => "0")).match(/\d+/) ?? ["0"])[0]);
await say("reason");
await scrollTo(p.locator("#memo-h"));
await moveTo(p.getByText(/Suggest (approve|manual review|decline)/).first());
await say("fallback");
await moveTo(p.getByText(/^Fallback:|Written by Claude/).first());
await say("decide");
await scrollTo(p.locator("#dec-h"));
await click(p.getByRole("radio", { name: "Approve" }));
await moveTo(p.locator("#amt"));
await wait(500);
await type("#note", "Steady verified income; identity confirmed by TBC.", 15);
await click(p.getByRole("button", { name: /Record decision/ }));
await p.getByText("Human decision: Approved").first().waitFor();
await say("audit");
await scrollTo(p.locator("#audit-h"));
await moveTo(p.getByText("Human decision: Approved").first());
await voDone();

// ---------- Output and impact ----------
await tag("");
const s = await p.evaluate(async () => (await (await fetch(`/api/beta/lender/applicants`)).json())[0]);
console.log("applicant", JSON.stringify(s), "verified", verified, "ms", ms);
await card("impact", `<div class="k">OUTPUT &amp; IMPACT · MEASURED IN THIS RUN</div><h1>${verified} payments verified at source.<br>0 screenshots.</h1><p>Report built in ${ms} ms · 1 forged email blocked · ${stmt} more from her monthly statement</p><p>Score ${s.score} · decision recorded by a person, with a full audit trail</p><p>Trustline does the collecting and checking. The officer decides.</p><span class="flag">Synthetic data · demo mode</span>`);
await card("close", `<div class="k">TRUSTLINE</div><h1>Designers today.<br>Every freelancer next.</h1><p>Let’s make freelancers bankable.</p>`);
console.log("END", T());
await p.close();
await ctx.close();
await b.close();
