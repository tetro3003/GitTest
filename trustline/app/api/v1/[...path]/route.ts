import { handleHttp } from "@/server/app";

/** Trustline REST API v1 — every /api/v1/* request is handled by server/router.ts. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleHttp(req, path);
}

export { handler as GET, handler as POST, handler as PATCH, handler as OPTIONS };
