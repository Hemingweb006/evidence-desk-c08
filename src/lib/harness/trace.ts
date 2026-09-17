import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { Check, Span } from "../types";
import type { ToolLog } from "./permissions";

export interface Ctx {
  tools: ToolLog[];
  checks: Check[];
  llm: { model?: string; tokensIn: number; tokensOut: number };
  summary: string;
}

export type StepEvent =
  | { type: "step_start"; node: string; label: string }
  | { type: "step_end"; span: Span };

/** Chaque étape du graphe produit un « span » (principe Mia : traces). */
export function traced<S extends { spans: Span[] }, U extends Partial<S>>(
  node: string,
  label: string,
  fn: (s: S, ctx: Ctx) => Promise<U>,
) {
  return async (state: S, cfg: LangGraphRunnableConfig): Promise<U & { spans: Span[] }> => {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    cfg.writer?.({ type: "step_start", node, label } satisfies StepEvent);
    const ctx: Ctx = { tools: [], checks: [], llm: { tokensIn: 0, tokensOut: 0 }, summary: "" };
    const update = await fn(state, ctx); // une interruption humaine remonte volontairement
    const span: Span = {
      node, label, startedAt, ms: Date.now() - t0,
      model: ctx.llm.model, tokensIn: ctx.llm.tokensIn, tokensOut: ctx.llm.tokensOut,
      tools: ctx.tools, checks: ctx.checks, summary: ctx.summary,
    };
    cfg.writer?.({ type: "step_end", span } satisfies StepEvent);
    return { ...update, spans: [span] };
  };
}

export function track(ctx: Ctx, u: { model: string; tokensIn: number; tokensOut: number }) {
  ctx.llm.model = ctx.llm.model && ctx.llm.model !== u.model ? `${ctx.llm.model}, ${u.model}` : u.model;
  ctx.llm.tokensIn += u.tokensIn;
  ctx.llm.tokensOut += u.tokensOut;
}

/** Exécute des tâches avec une concurrence bornée. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
