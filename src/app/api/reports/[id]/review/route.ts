import { z } from "zod";
import { reviewReport } from "@/lib/actions";
import { errorResponse, langOf, msg } from "@/lib/i18n/server";

export const runtime = "nodejs";

const Body = z.object({
  decision: z.enum(["approve", "changes"]),
  reviewer: z.string().trim().min(2).max(60),
  role: z.enum(["officer", "reviewer"]),
  note: z.string().trim().max(300).default(""),
});

export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]/review">) {
  const { id } = await ctx.params;
  const lang = langOf(req);
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: msg(p.error.issues.some((i) => i.path[0] === "reviewer") ? "nameRequired" : "invalid", lang) }, { status: 400 });
  if (p.data.decision === "changes" && p.data.note.length < 5) return Response.json({ error: msg("noteRequired", lang) }, { status: 400 });
  try {
    await reviewReport(id, p.data);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e, lang, 400);
  }
}
