import { z } from "zod";
import { checkReportText, templateSections } from "@/lib/graph/report";
import { runAnalysis } from "@/lib/graph/analyze";
import { normalizeType } from "@/lib/sample";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  period: z.string().default("Exercise week 1"),
  evidence: z.array(z.object({ id: z.string(), type: z.string(), text: z.string() })).min(1),
});

/** Mode sans état pour les évaluations : n'écrit rien dans l'espace de travail. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: p.error.message }, { status: 400 });
  const now = new Date().toISOString();
  const evidence = p.data.evidence.map((e) => ({ ...e, type: normalizeType(e.type), origin: "supplied" as const, addedAt: now, typeConfirmed: true }));
  const t0 = Date.now();
  const useCache = new URL(req.url).searchParams.get("cache") === "1";
  const out = await runAnalysis({ analysisId: "eval", evidence, period: p.data.period, registry: {}, useCache });
  const templateProblems = [
    ...checkReportText(templateSections(out.claims, "en"), out.claims, "en"),
    ...checkReportText(templateSections(out.claims, "de"), out.claims, "de").map((p) => `[DE] ${p}`),
  ];
  return Response.json({ claims: out.claims, latencyMs: Date.now() - t0, stats: out.stats, templateProblems });
}
