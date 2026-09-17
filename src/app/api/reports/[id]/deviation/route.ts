import { z } from "zod";
import { setDeviationNote } from "@/lib/actions";
import { errorResponse, langOf, msg } from "@/lib/i18n/server";

export const runtime = "nodejs";

const Body = z.object({
  rowKey: z.enum(["participants", "completion", "passed", "sessions"]),
  text: z.string().max(600),
  by: z.string().trim().min(2).max(60),
  role: z.enum(["officer", "reviewer"]),
});

/** Begründung einer Soll-Ist-Abweichung (saisie humaine, non vérifiée par machine, étiquetée comme telle). */
export async function PUT(req: Request, ctx: RouteContext<"/api/reports/[id]/deviation">) {
  const { id } = await ctx.params;
  const lang = langOf(req);
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: msg(p.error.issues.some((i) => i.path[0] === "by") ? "nameRequired" : "invalid", lang) }, { status: 400 });
  try {
    const notes = await setDeviationNote(id, p.data);
    return Response.json({ notes });
  } catch (e) {
    return errorResponse(e, lang, 400);
  }
}
