import type { NewWork, Run } from "../store";
import { bearerGet, type OAuthSecret } from "./oauth";

/**
 * Canva, Webflow, Miro and Dribbble: each read with the designer's own
 * read-only access, turned into work facts. Designs themselves are never copied,
 * only dates, titles and who else took part.
 */

type Fetch = typeof fetch;

export interface WorkRead {
  /** Display name of the account, for the connection label and name matching. */
  accountName: string;
  facts: NewWork[];
}

const iso = (v: string | number) => new Date(typeof v === "number" ? v * 1000 : v).toISOString();

/* ---------- Canva ---------- */

interface CanvaDesign {
  id: string;
  title?: string;
  created_at: number;
  updated_at: number;
  page_count?: number;
}

export async function readCanva(secret: OAuthSecret, run: Run, f: Fetch = fetch): Promise<WorkRead> {
  const api = "https://api.canva.com/rest/v1";
  const get = bearerGet("Canva", secret.accessToken, f);
  run.step("trustline", "Asking Canva whose account this is", `GET ${api}/users/me/profile`);
  const me = await get<{ profile?: { display_name?: string } }>(`${api}/users/me/profile`);
  const accountName = me.profile?.display_name ?? "Canva user";
  run.ok("canva", `Canva account: ${accountName}`);
  run.step("trustline", "Listing designs you own, newest edits first", `GET ${api}/designs?ownership=owned&sort_by=modified_descending`);
  const designs: CanvaDesign[] = [];
  let cont = "";
  for (let page = 0; page < 8; page++) {
    const r = await get<{ items: CanvaDesign[]; continuation?: string }>(`${api}/designs?ownership=owned&sort_by=modified_descending${cont ? `&continuation=${encodeURIComponent(cont)}` : ""}`);
    designs.push(...r.items);
    if (!r.continuation) break;
    cont = r.continuation;
  }
  const facts: NewWork[] = [];
  for (const d of designs) {
    const item = d.title?.trim() || "Untitled design";
    facts.push({ extId: `cv:${d.id}:c`, at: iso(d.created_at), source: "canva", kind: "edit", item, person: null });
    if (d.updated_at - d.created_at > 600) facts.push({ extId: `cv:${d.id}:u:${d.updated_at}`, at: iso(d.updated_at), source: "canva", kind: "edit", item, person: null });
  }
  run.ok("canva", `${designs.length} designs; ${facts.length} creation and editing moments`, "Each daily read adds that day's edits, so history grows over time");
  return { accountName, facts };
}

/* ---------- Webflow ---------- */

interface WebflowSite {
  id: string;
  displayName: string;
  createdOn?: string;
  lastPublished?: string | null;
  lastUpdated?: string;
  customDomains?: { url: string }[];
}

export async function readWebflow(secret: OAuthSecret, run: Run, f: Fetch = fetch): Promise<WorkRead> {
  const api = "https://api.webflow.com/v2";
  const get = bearerGet("Webflow", secret.accessToken, f);
  let accountName = "Webflow";
  try {
    run.step("trustline", "Asking Webflow who authorised this access", `GET ${api}/token/authorized_by`);
    const u = await get<{ firstName?: string; lastName?: string; email?: string }>(`${api}/token/authorized_by`);
    accountName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || accountName;
    run.ok("webflow", `Webflow account: ${accountName}`);
  } catch {
    run.step("webflow", "This is a site token, so Webflow doesn't name the person. Continuing with the site data.");
  }
  run.step("trustline", "Listing your Webflow sites", `GET ${api}/sites`);
  const { sites } = await get<{ sites: WebflowSite[] }>(`${api}/sites`);
  const facts: NewWork[] = [];
  for (const s of sites) {
    const domain = s.customDomains?.[0]?.url?.replace(/^https?:\/\//, "") ?? null;
    if (s.createdOn) facts.push({ extId: `wf:${s.id}:c`, at: iso(s.createdOn), source: "webflow", kind: "edit", item: s.displayName, person: domain });
    if (s.lastPublished) facts.push({ extId: `wf:${s.id}:p:${s.lastPublished}`, at: iso(s.lastPublished), source: "webflow", kind: "publish", item: s.displayName, person: domain });
    run.step("trustline", `Reading page edits in “${s.displayName}”${domain ? ` (${domain})` : ""}`, `GET ${api}/sites/${s.id}/pages`);
    try {
      const { pages } = await get<{ pages: { id: string; title?: string; createdOn?: string; lastUpdated?: string }[] }>(`${api}/sites/${s.id}/pages?limit=100`);
      for (const p of pages) if (p.lastUpdated) facts.push({ extId: `wf:pg:${p.id}:${p.lastUpdated}`, at: iso(p.lastUpdated), source: "webflow", kind: "edit", item: s.displayName, person: domain });
    } catch (e) {
      run.warn("webflow", `Couldn't read pages of “${s.displayName}”: ${(e as Error).message}`);
    }
  }
  const published = sites.filter((s) => s.lastPublished).length;
  const domains = sites.filter((s) => s.customDomains?.length).length;
  run.ok("webflow", `${sites.length} sites, ${published} published, ${domains} on a client's own domain`, "A site on a client's domain is strong evidence of delivered work");
  return { accountName, facts };
}

/* ---------- Miro ---------- */

interface MiroBoard {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
}

export async function readMiro(secret: OAuthSecret, run: Run, f: Fetch = fetch): Promise<WorkRead> {
  const get = bearerGet("Miro", secret.accessToken, f);
  run.step("trustline", "Asking Miro whose access this is", "GET https://api.miro.com/v1/oauth-token");
  const ctx = await get<{ user: { id: string; name: string }; team?: { name?: string } }>("https://api.miro.com/v1/oauth-token");
  const myId = String(ctx.user.id);
  run.ok("miro", `Miro account: ${ctx.user.name}${ctx.team?.name ? ` · team ${ctx.team.name}` : ""}`);
  run.step("trustline", "Listing boards you can see", "GET https://api.miro.com/v2/boards?limit=50");
  const { data: boards } = await get<{ data: MiroBoard[] }>("https://api.miro.com/v2/boards?limit=50&sort=last_modified");
  const facts: NewWork[] = [];
  const people = new Set<string>();
  for (const b of boards.slice(0, 20)) {
    run.step("trustline", `Reading who did what on “${b.name}”`, `GET /v2/boards/${b.id}/items · /members`);
    const items = await get<{ data: { id: string; createdAt: string; modifiedAt: string; createdBy?: { id: string }; modifiedBy?: { id: string } }[] }>(`https://api.miro.com/v2/boards/${b.id}/items?limit=50`);
    for (const it of items.data) {
      if (String(it.modifiedBy?.id) === myId) facts.push({ extId: `mi:${it.id}:${it.modifiedAt}`, at: iso(it.modifiedAt), source: "miro", kind: "edit", item: b.name, person: null });
      else if (String(it.createdBy?.id) === myId) facts.push({ extId: `mi:${it.id}:c`, at: iso(it.createdAt), source: "miro", kind: "edit", item: b.name, person: null });
    }
    const members = await get<{ data: { id: string; name: string }[] }>(`https://api.miro.com/v2/boards/${b.id}/members?limit=50`);
    for (const m of members.data)
      if (String(m.id) !== myId) {
        people.add(m.name);
        facts.push({ extId: `mi:m:${b.id}:${m.id}`, at: iso(b.createdAt), source: "miro", kind: "comment", item: b.name, person: m.name });
      }
  }
  run.ok("miro", `${boards.length} boards · ${facts.filter((x) => x.kind === "edit").length} edits by you · ${people.size} collaborator${people.size === 1 ? "" : "s"}${people.size ? ` (${[...people].slice(0, 3).join(", ")}${people.size > 3 ? "…" : ""})` : ""}`);
  return { accountName: ctx.user.name, facts };
}

/* ---------- Dribbble ---------- */

export async function readDribbble(secret: OAuthSecret, run: Run, f: Fetch = fetch): Promise<WorkRead & { memberSince: string | null }> {
  const api = "https://api.dribbble.com/v2";
  const get = bearerGet("Dribbble", secret.accessToken, f);
  run.step("trustline", "Asking Dribbble whose profile this is", `GET ${api}/user`);
  const u = await get<{ name?: string; login: string; created_at?: string; html_url?: string }>(`${api}/user`);
  run.ok("dribbble", `Dribbble: ${u.name ?? u.login}${u.created_at ? ` · member since ${u.created_at.slice(0, 4)}` : ""}`);
  run.step("trustline", "Listing your published shots", `GET ${api}/user/shots?per_page=100`);
  const shots = await get<{ id: number; title: string; published_at?: string }[]>(`${api}/user/shots?per_page=100`);
  const facts: NewWork[] = shots.filter((s) => s.published_at).map((s) => ({ extId: `dr:${s.id}`, at: iso(s.published_at!), source: "dribbble", kind: "shot", item: s.title, person: null }));
  run.ok("dribbble", `${facts.length} published shot${facts.length === 1 ? "" : "s"}`, "Portfolio counts towards track record, not hours");
  return { accountName: u.name ?? u.login, facts, memberSince: u.created_at ?? null };
}
