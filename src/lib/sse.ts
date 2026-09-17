import { DEFAULT_LANG, type Lang } from "./i18n/core";
import { AppError, msg } from "./i18n/server";

/** Flux Server-Sent Events : chaque étape du graphe est envoyée en direct à l'interface. */
export function sse(run: (send: (e: unknown) => void) => Promise<unknown>, lang: Lang = DEFAULT_LANG) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await run(send);
      } catch (err) {
        send({ type: "error", message: err instanceof AppError ? msg(err.key, lang, err.vars) : String(err instanceof Error ? err.message : err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
