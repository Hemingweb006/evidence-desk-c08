"use client";

import { Check, Loader2 } from "lucide-react";
import type { Span } from "@/lib/types";
import { fmtMs } from "./ui";
import { useWorkspace } from "./workspace";

export type Step = { node: string; label: string; span?: Span };

export function applyStepEvent(steps: Step[], e: { type: string; node?: string; label?: string; span?: Span }): Step[] {
  if (e.type === "step_start") return [...steps, { node: e.node!, label: e.label! }];
  if (e.type === "step_end" && e.span) {
    const out = [...steps];
    for (let i = out.length - 1; i >= 0; i--)
      if (out[i].node === e.span.node && !out[i].span) {
        out[i] = { ...out[i], span: e.span };
        break;
      }
    return out;
  }
  return steps;
}

/** Progression en direct des étapes du graphe. */
export function Pipeline({ steps, running }: { steps: Step[]; running: boolean }) {
  const { t } = useWorkspace();
  if (!steps.length && running)
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" /> {t.steps.starting}
      </div>
    );
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {steps.map((s, i) => (
        <li
          key={i}
          title={s.span?.summary}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${s.span ? "border-line text-ink-2" : "border-accent text-accent-ink"}`}
        >
          {s.span ? <Check size={11} /> : <span className="pulse h-1.5 w-1.5 rounded-full bg-accent" />}
          {t.steps.node[s.node] ?? s.label}
          {s.span && <span className="tabular text-muted">{fmtMs(s.span.ms)}</span>}
        </li>
      ))}
    </ol>
  );
}
