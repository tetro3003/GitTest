import { ApiError } from "@/lib/api/client";
import type { WorkEvent } from "@/lib/types";

/**
 * Figma connector: version history and comments of the files the designer
 * picks, using their personal access token (Figma → Settings → Security →
 * Personal access tokens, scopes: file_content:read, file_versions:read,
 * file_comments:read). The token is used once and never stored.
 * Figma saves a checkpoint roughly every 30 minutes of editing, so each of
 * the designer's own versions counts as ~30 minutes of design work.
 */
type Fetch = typeof fetch;

export function figmaFileKey(input: string): string | null {
  const s = input.trim();
  const m = s.match(/figma\.com\/(?:file|design|proto|board|slides)\/([a-zA-Z0-9]{10,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9]{10,}$/.test(s) ? s : null;
}

interface Version {
  created_at: string;
  user: { id: string };
}

export async function fetchFigmaWork(token: string, files: string[], opts: { fetch?: Fetch } = {}): Promise<{ label: string; events: WorkEvent[] }> {
  if (!token.trim()) throw new ApiError("Paste a Figma personal access token", 400);
  const keys = [...new Set(files.map(figmaFileKey).filter((k): k is string => !!k))].slice(0, 20);
  if (!keys.length) throw new ApiError("Paste at least one Figma file link", 400);
  const f = opts.fetch ?? fetch;
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`https://api.figma.com${path}`, { headers: { "X-Figma-Token": token.trim() } });
    if (res.status === 401 || res.status === 403) throw new ApiError("Figma rejected the token, or it can't read this file. Check the token's scopes.", 400);
    if (res.status === 404) throw new ApiError("Figma couldn't find one of the files. Check the link.", 400);
    if (!res.ok) throw new ApiError(`Figma returned ${res.status}`, 502);
    return (await res.json()) as T;
  };

  const me = await get<{ id: string; handle: string }>("/v1/me");
  const events: WorkEvent[] = [];
  for (const key of keys) {
    const file = await get<{ name: string }>(`/v1/files/${key}?depth=1`);
    const versions: Version[] = [];
    let path: string | null = `/v1/files/${key}/versions?page_size=50`;
    for (let page = 0; path && page < 6; page++) {
      const r: { versions: Version[]; pagination?: { next_page?: string } } = await get(path);
      versions.push(...r.versions);
      const next = r.pagination?.next_page;
      path = next ? next.replace(/^https:\/\/api\.figma\.com/, "") : null;
    }
    const mine = versions.filter((v) => v.user?.id === me.id);
    // One design session per day per file, ~30 min per checkpoint.
    const perDay = new Map<string, Version[]>();
    for (const v of mine) perDay.set(v.created_at.slice(0, 10), [...(perDay.get(v.created_at.slice(0, 10)) ?? []), v]);
    for (const list of perDay.values()) {
      events.push({ at: list[0].created_at, minutes: Math.min(480, 30 * list.length), kind: "design_session", item: file.name });
      for (const v of list) events.push({ at: v.created_at, minutes: 0, kind: "design_version", item: file.name });
    }
    const comments = await get<{ comments: { created_at: string; user: { id: string } }[] }>(`/v1/files/${key}/comments`);
    for (const c of comments.comments) if (c.user?.id !== me.id) events.push({ at: c.created_at, minutes: 0, kind: "client_comment", item: file.name });
  }
  if (!events.some((e) => e.kind === "design_session")) throw new ApiError("None of these files has edits by you yet", 400);
  return { label: `Figma · ${me.handle}`, events };
}
