import { z } from "zod";
import { generateReport } from "@/lib/actions";
import { langOf } from "@/lib/i18n/server";
import { updateWorkspace } from "@/lib/store";
import { sse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ preparedBy: z.string().trim().max(60).default("") });

/** Berichtsentwurf : les claims de la mappe qui n'existent plus sont retirés d'abord. `?supersedes=<id>` = nouvelle version. */
export async function POST(req: Request) {
  const lang = langOf(req);
  const supersedes = new URL(req.url).searchParams.get("supersedes") ?? undefined;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  const preparedBy = body.success ? body.data.preparedBy : "";
  return sse(async (send) => {
    await updateWorkspace((w) => {
      w.bag = w.bag.filter((id) => w.claims.some((c) => c.id === id));
    });
    await generateReport(send, { supersedes, preparedBy });
  }, lang);
}
