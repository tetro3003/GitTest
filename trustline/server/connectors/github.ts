import { ApiError } from "@/lib/api/client";
import type { WorkEvent } from "@/lib/types";

/**
 * GitHub connector: public commit and merged-PR metadata for a username
 * (never code). Works without a token; set GITHUB_TOKEN for higher rate limits.
 * Coding time is estimated from commit timestamps: 60 min for the first commit
 * of a day, +30 min per extra commit, max 8 h a day.
 */
type Fetch = typeof fetch;

interface SearchCommit {
  commit: { author: { date: string } };
  repository: { full_name: string };
}
interface SearchIssue {
  closed_at: string | null;
  comments: number;
  repository_url: string;
  pull_request?: { merged_at?: string | null };
}

export async function fetchGitHubWork(username: string, opts: { fetch?: Fetch; token?: string; now?: Date; days?: number } = {}): Promise<{ label: string; events: WorkEvent[] }> {
  const u = username.trim().replace(/^@/, "");
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(u)) throw new ApiError("That doesn't look like a GitHub username", 400);
  const f = opts.fetch ?? fetch;
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "trustline-work-checker" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`https://api.github.com${path}`, { headers });
    if (res.status === 404) throw new ApiError(`No GitHub user called “${u}”`, 400);
    if (res.status === 403 || res.status === 429) throw new ApiError("GitHub is rate-limiting us right now. Wait a minute, or set GITHUB_TOKEN on the server.", 503);
    if (!res.ok) throw new ApiError(`GitHub returned ${res.status}`, 502);
    return (await res.json()) as T;
  };

  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.days ?? 182) * 86_400_000).toISOString().slice(0, 10);
  await get(`/users/${encodeURIComponent(u)}`);

  const commits: SearchCommit[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await get<{ items: SearchCommit[] }>(`/search/commits?q=${encodeURIComponent(`author:${u} author-date:>=${since}`)}&sort=author-date&order=desc&per_page=100&page=${page}`);
    commits.push(...r.items);
    if (r.items.length < 100) break;
  }
  const prs = await get<{ items: SearchIssue[] }>(`/search/issues?q=${encodeURIComponent(`author:${u} type:pr is:merged merged:>=${since}`)}&per_page=100`);

  const byDay = new Map<string, SearchCommit[]>();
  for (const c of commits) {
    const day = c.commit.author.date.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), c]);
  }
  const events: WorkEvent[] = [];
  for (const list of byDay.values()) {
    const dayMinutes = Math.min(480, 60 + 30 * (list.length - 1));
    for (const c of list) events.push({ at: new Date(c.commit.author.date).toISOString(), minutes: Math.round((dayMinutes / list.length) * 10) / 10, kind: "commit", item: c.repository.full_name });
  }
  for (const p of prs.items) {
    const at = p.pull_request?.merged_at ?? p.closed_at;
    if (!at) continue;
    const repo = p.repository_url.split("/repos/")[1] ?? "";
    events.push({ at, minutes: 0, kind: "pr_merged", item: repo });
    if (p.comments > 0) events.push({ at, minutes: 0, kind: "review", units: p.comments, item: repo });
  }
  if (!events.length) throw new ApiError(`GitHub user “${u}” has no public commits in the last 6 months`, 400);
  return { label: `github.com/${u}`, events };
}
