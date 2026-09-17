import { z } from "zod";
import { langOf, msg } from "@/lib/i18n/server";
import { updateWorkspace } from "@/lib/store";

export const runtime = "nodejs";

/** Journal « douleur → retour client → changement » (livrable demandé). */
export async function POST(req: Request) {
  const p = z
    .object({ who: z.string().trim().min(1).max(60), kind: z.enum(["pain", "feedback", "change"]), note: z.string().trim().min(3).max(500) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: msg("whoWhat", langOf(req)) }, { status: 400 });
  await updateWorkspace((w) => void w.feedbackLog.push({ at: new Date().toISOString(), ...p.data }));
  return Response.json({ ok: true });
}
