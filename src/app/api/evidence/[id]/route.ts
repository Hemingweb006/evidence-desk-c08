import { z } from "zod";
import { EVIDENCE_TYPE_LABEL } from "@/lib/engine/lexicon";
import { langOf, msg } from "@/lib/i18n/server";
import { updateWorkspace } from "@/lib/store";
import type { EvidenceType } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({ type: z.enum(Object.keys(EVIDENCE_TYPE_LABEL) as [EvidenceType, ...EvidenceType[]]) });

/** La personne confirme le type de pièce (il fixe le plafond de preuve). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/evidence/[id]">) {
  const { id } = await ctx.params;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: p.error.message }, { status: 400 });
  const ok = await updateWorkspace((w) => {
    const ev = w.evidence.find((e) => e.id === id);
    if (!ev) return false;
    ev.type = p.data.type;
    ev.typeConfirmed = true;
    return true;
  });
  return ok ? Response.json({ ok }) : Response.json({ error: msg("notFound", langOf(req)) }, { status: 404 });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/evidence/[id]">) {
  const { id } = await ctx.params;
  const result = await updateWorkspace((w) => {
    const ev = w.evidence.find((e) => e.id === id);
    if (!ev) return "missing";
    if (ev.origin === "supplied") return "supplied";
    w.evidence = w.evidence.filter((e) => e.id !== id);
    return "ok";
  });
  if (result === "supplied") return Response.json({ error: msg("suppliedDelete", langOf(req)) }, { status: 400 });
  if (result === "missing") return Response.json({ error: msg("notFound", langOf(req)) }, { status: 404 });
  return Response.json({ ok: true });
}
