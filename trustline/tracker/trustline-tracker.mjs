#!/usr/bin/env node
/**
 * Trustline desktop tracker — door #3 of the universal Work Checker.
 *
 * Counts the minutes you actively work in chosen apps (Photoshop, Illustrator,
 * AutoCAD, Excel… anything) and sends the totals to your Trustline webhook.
 * It only reads the NAME of the app in front. No screenshots, no window titles,
 * no keystrokes. Idle time (no mouse/keyboard for 5 min) is not counted.
 *
 * Usage:
 *   node tracker/trustline-tracker.mjs --url <webhook url> --apps "Photoshop,Illustrator"
 * Options:
 *   --interval 60   seconds between checks          --flush 300  seconds between uploads
 *   --dry-run       print instead of sending        --once       print the app in front and exit
 *   --simulate      pretend the first app is always in front (for testing)
 * Needs Node.js 18+. macOS, Windows and Linux (X11 with xdotool) supported.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const url = opt("url");
const apps = (opt("apps", "") || "").split(",").map((a) => a.trim()).filter(Boolean);
const interval = Number(opt("interval", "60")) * 1000;
const flushEvery = Number(opt("flush", "300")) * 1000;
const IDLE_LIMIT_S = 300;

if (!flag("once") && (!url || !apps.length)) {
  console.error('Usage: node tracker/trustline-tracker.mjs --url <webhook url> --apps "Photoshop,Illustrator"');
  process.exit(1);
}

async function frontApp() {
  if (flag("simulate")) return apps[0] ?? "Simulated app";
  try {
    if (process.platform === "darwin") {
      const { stdout } = await run("osascript", ["-e", 'tell application "System Events" to get name of first application process whose frontmost is true']);
      return stdout.trim();
    }
    if (process.platform === "win32") {
      const ps = `Add-Type @"
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }
"@; $p=0; [W]::GetWindowThreadProcessId([W]::GetForegroundWindow(), [ref]$p) | Out-Null; (Get-Process -Id $p).ProcessName`;
      const { stdout } = await run("powershell", ["-NoProfile", "-Command", ps]);
      return stdout.trim();
    }
    const { stdout } = await run("xdotool", ["getactivewindow", "getwindowpid"]);
    return readFileSync(`/proc/${stdout.trim()}/comm`, "utf8").trim();
  } catch {
    return null;
  }
}

async function idleSeconds() {
  if (flag("simulate")) return 0;
  try {
    if (process.platform === "darwin") {
      const { stdout } = await run("ioreg", ["-c", "IOHIDSystem"]);
      const m = stdout.match(/"HIDIdleTime" = (\d+)/);
      return m ? Number(m[1]) / 1e9 : 0;
    }
    if (process.platform === "win32") {
      const ps = `Add-Type @"
using System; using System.Runtime.InteropServices;
public class I { [StructLayout(LayoutKind.Sequential)] public struct L { public uint s; public uint t; }
[DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref L l); }
"@; $l = New-Object I+L; $l.s = 8; [I]::GetLastInputInfo([ref]$l) | Out-Null; ([Environment]::TickCount - $l.t) / 1000`;
      const { stdout } = await run("powershell", ["-NoProfile", "-Command", ps]);
      return Number(stdout.trim()) || 0;
    }
    const { stdout } = await run("xprintidle");
    return Number(stdout.trim()) / 1000;
  } catch {
    return 0;
  }
}

const matchApp = (name) => apps.find((a) => name.toLowerCase().includes(a.toLowerCase()));

if (flag("once")) {
  const name = await frontApp();
  console.log(`App in front: ${name ?? "(couldn't read it — macOS: allow Terminal in System Settings → Privacy & Security → Accessibility; Linux: install xdotool)"}`);
  console.log(`Idle for: ${Math.round(await idleSeconds())} s`);
  process.exit(0);
}

let minutes = new Map();
let windowStart = new Date();

async function sample() {
  const name = await frontApp();
  const idle = await idleSeconds();
  const app = name && idle < IDLE_LIMIT_S ? matchApp(name) : undefined;
  if (app) minutes.set(app, (minutes.get(app) ?? 0) + interval / 60000);
  process.stdout.write(`\r${new Date().toLocaleTimeString()}  in front: ${(name ?? "?").padEnd(24)}  counting: ${app ?? "-"}        `);
}

async function flush() {
  const events = [...minutes.entries()].filter(([, m]) => m > 0).map(([app, m]) => ({ at: windowStart.toISOString(), minutes: Math.round(m * 10) / 10, kind: "app_session", item: app }));
  minutes = new Map();
  windowStart = new Date();
  if (!events.length) return;
  if (flag("dry-run")) return console.log(`\nWould send: ${JSON.stringify(events)}`);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "tracker", events }) });
    const body = await res.json().catch(() => ({}));
    console.log(res.ok ? `\nSent ${events.map((e) => `${e.minutes} min ${e.item}`).join(", ")}` : `\nServer said ${res.status}: ${body.error ?? ""}`);
  } catch (e) {
    console.log(`\nCouldn't reach Trustline (${e.message}). Will try again with the next batch.`);
  }
}

console.log(`Trustline tracker — counting ${apps.join(", ")}. Press Ctrl+C to stop.`);
await sample();
setInterval(sample, interval);
setInterval(flush, flushEvery);
process.on("SIGINT", async () => {
  await flush();
  process.exit(0);
});
