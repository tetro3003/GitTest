"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { OAuthProvider } from "@/lib/beta/types";

/**
 * Step-by-step "turn this on" instructions for a "Sign in with …" button.
 * Each company only lets registered apps ask for access, so the person running
 * Trustline creates a free developer app once and pastes its two keys into .env.local.
 */

interface Guide {
  site: string;
  url: string;
  steps: React.ReactNode[];
  env: [string, string];
  /** Canva refuses "localhost" in redirect URLs. */
  useLoopbackIp?: boolean;
  note?: React.ReactNode;
}

const GUIDES: Record<OAuthProvider, Guide> = {
  google: {
    site: "Google Cloud Console",
    url: "https://console.cloud.google.com/auth/overview",
    steps: [
      <>Create or pick a project (top bar → project picker → <strong>New project</strong>).</>,
      <>Search <strong>Gmail API</strong> in the top search bar → <strong>Enable</strong>.</>,
      <>Open <strong>Google Auth Platform</strong> → <strong>Get started</strong>: app name, your email → Audience <strong>External</strong> → contact email → agree → <strong>Create</strong>.</>,
      <>Left menu <strong>Audience → Test users → + Add users</strong>: add the Gmail address you&apos;ll connect → <strong>Save</strong>.</>,
      <>Left menu <strong>Clients → + Create client → Web application</strong>. Under <strong>Authorized redirect URIs</strong> click <strong>+ Add URI</strong> and paste the address below → <strong>Create</strong>.</>,
      <>Copy the <strong>Client ID</strong> and <strong>Client secret</strong> from the window that opens (or click the client&apos;s name later).</>,
    ],
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    note: <>While the app is in &quot;Testing&quot;, only the test users you added can connect, and Google shows &quot;Google hasn&apos;t verified this app&quot;: click <strong>Continue</strong>. That&apos;s fine for the beta.</>,
  },
  canva: {
    site: "Canva Developers",
    url: "https://www.canva.com/developers/integrations/connect-api",
    steps: [
      <>Open <strong>Your integrations → Create an integration</strong> (Public: no, it stays private).</>,
      <>Under <strong>Scopes</strong> tick <strong>design:meta (read)</strong> and <strong>profile (read)</strong>.</>,
      <>Under <strong>Authentication → Authorized redirects</strong> add the address below.</>,
      <>Copy the <strong>Client ID</strong>, then <strong>Generate secret</strong> and copy it.</>,
    ],
    env: ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET"],
    useLoopbackIp: true,
    note: <>Canva doesn&apos;t accept &quot;localhost&quot;. Open Trustline at <strong>http://127.0.0.1:3000/beta</strong> (and log in there) when you connect Canva.</>,
  },
  webflow: {
    site: "Webflow",
    url: "https://webflow.com/dashboard",
    steps: [
      <>Workspace settings → <strong>Apps &amp; Integrations → Develop → Create an App</strong>.</>,
      <><strong>App info</strong>: any name, description and homepage URL → <strong>Continue</strong>.</>,
      <><strong>Building blocks</strong>: switch on <strong>Data client (REST API)</strong>. Paste the address below as the <strong>Redirect URI</strong>.</>,
      <>In the scopes list choose <strong>Read</strong> for <strong>Authorized user</strong>, <strong>Pages</strong> and <strong>Sites</strong>; leave everything else on no access → create the app.</>,
      <>On the app&apos;s page, copy the <strong>Client ID</strong> and <strong>Client secret</strong>.</>,
    ],
    env: ["WEBFLOW_CLIENT_ID", "WEBFLOW_CLIENT_SECRET"],
    note: <>Quicker option: close this and click <strong>Use a site token</strong>. It works right away for one site.</>,
  },
  miro: {
    site: "Miro",
    url: "https://miro.com/app/settings/user-profile/apps",
    steps: [
      <><strong>Your apps → Create new app</strong> (any name, your team).</>,
      <>Under <strong>Permissions</strong> tick <strong>boards:read</strong>.</>,
      <>Under <strong>Redirect URI for OAuth2.0</strong> add the address below and click <strong>Add</strong>.</>,
      <>Copy the <strong>Client ID</strong> and <strong>Client secret</strong> at the top of the app page.</>,
    ],
    env: ["MIRO_CLIENT_ID", "MIRO_CLIENT_SECRET"],
  },
  dribbble: {
    site: "Dribbble",
    url: "https://dribbble.com/account/applications/new",
    steps: [
      <>Fill name, description and website (http://localhost:3000 is fine).</>,
      <>Set the <strong>Callback URL</strong> to the address below and save.</>,
      <>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.</>,
    ],
    env: ["DRIBBBLE_CLIENT_ID", "DRIBBBLE_CLIENT_SECRET"],
  },
};

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
      <code className="min-w-0 flex-1 break-all font-mono text-[11px]">{text}</code>
      <button
        type="button"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? <Check className="size-3.5 text-positive" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

export function SetupGuide({ provider, name }: { provider: OAuthProvider; name: string }) {
  const g = GUIDES[provider];
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => setOrigin(window.location.origin), []);
  const base = g.useLoopbackIp ? origin.replace("//localhost", "//127.0.0.1") : origin;
  const redirect = `${base}/api/beta/oauth/${provider}/callback`;

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-dashed bg-background/50 p-4 text-sm">
      <p>
        {name} only lets <strong>registered apps</strong> ask for access, so this needs a free developer app (about 5 minutes, one time).
      </p>
      <a href={g.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline">
        Open {g.site} <ExternalLink className="size-3.5" />
      </a>
      <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
        {g.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <div className="space-y-1">
        <p className="text-xs font-medium">Redirect address to paste:</p>
        <CopyLine text={redirect} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">
          Then in the <code className="font-mono">trustline</code> folder, open <code className="font-mono">.env.local</code> (copy it from <code className="font-mono">.env.example</code> if it doesn&apos;t exist) and fill in:
        </p>
        <CopyLine text={`${g.env[0]}=paste-client-id-here`} />
        <CopyLine text={`${g.env[1]}=paste-client-secret-here`} />
      </div>
      <p className="text-xs text-muted-foreground">
        Save, then restart the app: in Terminal press <strong>Ctrl + C</strong> and run <code className="font-mono">npm run dev</code> again. The Connect button switches on.
      </p>
      {g.note && <p className="rounded-xl bg-warning-soft p-2.5 text-xs text-warning-strong">{g.note}</p>}
    </div>
  );
}
