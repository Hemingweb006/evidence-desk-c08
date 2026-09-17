import { prepareRedraft } from "@/lib/actions";
import { errorResponse, langOf } from "@/lib/i18n/server";

export const runtime = "nodejs";

/** Prépare une nouvelle version : mappe = claims encore valides + remplaçants. */
export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]/redraft">) {
  const { id } = await ctx.params;
  try {
    const claimIds = await prepareRedraft(id);
    return Response.json({ claimIds });
  } catch (e) {
    return errorResponse(e, langOf(req), 400);
  }
}
