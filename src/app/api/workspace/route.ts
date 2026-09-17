import { config } from "@/lib/config";
import { SIMULATIONS } from "@/lib/sample";
import { getWorkspace } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const w = getWorkspace();
  return Response.json({
    ...w,
    simulations: Object.entries(SIMULATIONS).map(([key, s]) => ({ key, label: s.label, description: s.description, labelDe: s.labelDe, descriptionDe: s.descriptionDe, added: s.evidence.every((e) => w.evidence.some((x) => x.id === e.id)) })),
    models: { question: config.questionModel, reader: config.readerModel, writer: config.writerModel },
    apiKey: !!config.deepseekApiKey,
  });
}
