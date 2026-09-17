import { analyze } from "@/lib/actions";
import { langOf } from "@/lib/i18n/server";
import { sse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  return sse(async (send) => {
    await analyze(send);
  }, langOf(req));
}
