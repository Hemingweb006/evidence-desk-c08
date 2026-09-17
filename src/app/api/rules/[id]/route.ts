import { z } from "zod";
import { updateWorkspace } from "@/lib/store";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: RouteContext<"/api/rules/[id]">) {
  const { id } = await ctx.params;
  const p = z.object({ active: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: p.error.message }, { status: 400 });
  await updateWorkspace((w) => {
    const r = w.rules.find((x) => x.id === id);
    if (r) r.active = p.data.active;
  });
  return Response.json({ ok: true });
}
