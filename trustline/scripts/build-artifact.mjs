// Builds a single self-contained HTML file of the whole app (for sharing as a
// hosted artifact). Requires `npm run build` first, for the compiled CSS.
import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = process.argv[2] ?? join(root, "dist-artifact");
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [join(root, "artifact/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  jsx: "automatic",
  logLevel: "warning",
  alias: { "next/link": join(root, "artifact/shims/link.tsx"), "next/navigation": join(root, "artifact/shims/navigation.ts") },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_API_MODE": '"mock"',
    "process.env.NEXT_PUBLIC_API_BASE_URL": "undefined",
  },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const cssDir = join(root, ".next/static/css");
const css = readdirSync(cssDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(cssDir, f), "utf8"))
  .join("\n")
  // Drop next/font faces (their files are not published); Google Fonts link replaces them.
  .replace(/@font-face\{[^}]*\}/g, "");

const html = `<title>Trustline Demo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap">
<style>${css}
:root{--font-sans:"Inter",ui-sans-serif,system-ui,sans-serif;--font-display:"Manrope","Inter",ui-sans-serif,system-ui,sans-serif}
body{background:var(--background);color:var(--foreground)}
#root{padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)}
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(join(out, "trustline-demo.html"), html);
console.log(`wrote ${join(out, "trustline-demo.html")} (${(html.length / 1024).toFixed(0)} KB)`);
