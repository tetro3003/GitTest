import { beta } from "@/server/beta";

/** Designer beta API — handled by server/beta/http.ts. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return beta().handle(req, path);
}

export { handler as GET, handler as POST, handler as DELETE };
