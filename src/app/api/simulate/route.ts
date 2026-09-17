import { z } from "zod";
import { simulate } from "@/lib/actions";
import { langOf, msg } from "@/lib/i18n/server";
import { sse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Événement simulé → ré-analyse automatique → impact (flux SSE, sans second clic). */
export async function POST(req: Request) {
  const lang = langOf(req);
  const p = z.object({ key: z.string() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: msg("unknownSim", lang) }, { status: 400 });
  return sse(async (send) => {
    send({ type: "event_applied", key: p.data.key });
    await simulate(p.data.key, send);
  }, lang);
}
