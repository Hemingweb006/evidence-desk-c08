import { resetWorkspace } from "@/lib/store";

export const runtime = "nodejs";

/** État de départ reproductible (C08 initial.json, non modifié). */
export async function POST() {
  resetWorkspace();
  return Response.json({ ok: true });
}
