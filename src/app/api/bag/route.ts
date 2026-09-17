import { z } from "zod";
import { updateWorkspace } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["add", "remove", "clear", "add_many"]), claimId: z.string().optional(), claimIds: z.array(z.string()).optional() });

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: p.error.message }, { status: 400 });
  const { action } = p.data;
  const bag = await updateWorkspace((w) => {
    const add = (id: string) => {
      const c = w.claims.find((x) => x.id === id);
      if (!c || w.bag.includes(id)) return;
      w.bag.push(id);
      w.bagMeta[id] = { addedAt: new Date().toISOString(), statusAtAdd: c.status };
    };
    if (action === "add" && p.data.claimId) add(p.data.claimId);
    if (action === "add_many") (p.data.claimIds ?? []).forEach(add);
    if (action === "remove" && p.data.claimId) {
      w.bag = w.bag.filter((x) => x !== p.data.claimId);
      delete w.bagMeta[p.data.claimId];
    }
    if (action === "clear") {
      w.bag = [];
      w.bagMeta = {};
    }
    return w.bag;
  });
  return Response.json({ bag });
}
