"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { TOOL_POLICY } from "@/lib/harness/permissions";
import { REPORT_STATUS_L } from "@/lib/i18n/terms";
import type { Span } from "@/lib/types";
import { Loading, PageHeader, Pill, fmtMs } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

function SpanList({ spans }: { spans: Span[] }) {
  const { t } = useWorkspace();
  const total = Math.max(spans.reduce((s, x) => s + x.ms, 0), 1);
  let offset = 0;
  return (
    <div className="space-y-2">
      {spans.map((s, i) => {
        const left = (offset / total) * 100;
        offset += s.ms;
        const failed = s.checks.some((c) => !c.pass);
        return (
          <details key={i} className="rounded-[3px] border border-line" open={failed}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-3 py-2">
              <span className="w-52 shrink-0 text-sm font-bold">{t.steps.node[s.node] ?? s.label}</span>
              <span className="relative hidden h-2 flex-1 rounded bg-surface-2 sm:block">
                <span className="absolute inset-y-0 rounded" style={{ left: `${left}%`, width: `${Math.max((s.ms / total) * 100, 0.6)}%`, background: "var(--bar)" }} />
              </span>
              <span className="tabular w-16 text-right text-xs text-ink-2">{fmtMs(s.ms)}</span>
              {failed && <Pill cls="bg-warning-soft text-warning-ink">{t.traces.failed}</Pill>}
              <span className="basis-full text-xs text-ink-2" lang="en">
                {s.summary}
              </span>
            </summary>
            <div className="grid gap-3 border-t border-line px-3 py-2 text-xs sm:grid-cols-3" lang="en">
              <div>
                <div className="mb-1 font-bold text-muted">{t.traces.model}</div>
                {s.model ? (
                  <>
                    <div className="break-all">{s.model}</div>
                    <div className="tabular text-muted">{t.traces.tokens(s.tokensIn ?? 0, s.tokensOut ?? 0)}</div>
                  </>
                ) : (
                  <div className="text-muted">{t.traces.none}</div>
                )}
              </div>
              <div>
                <div className="mb-1 font-bold text-muted">{t.traces.tools((TOOL_POLICY[s.node] ?? []).join(", ") || "—")}</div>
                {s.tools.length === 0 && <div className="text-muted">{t.traces.noCall}</div>}
                {s.tools.map((x, j) => (
                  <div key={j} className={x.allowed ? "" : "text-critical-ink"}>
                    {x.allowed ? "✓" : t.traces.refused} {x.name}
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 font-bold text-muted">{t.traces.checks}</div>
                {s.checks.length === 0 && <div className="text-muted">—</div>}
                {s.checks.map((c, j) => (
                  <div key={j} className="flex gap-1">
                    {c.pass ? <Check size={12} className="mt-0.5 shrink-0 text-good-ink" /> : <X size={12} className="mt-0.5 shrink-0 text-critical-ink" />}
                    <span>
                      {c.name}
                      {c.detail && <span className="text-muted"> — {c.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default function TracesPage() {
  const { ws, t, lang, fmtDate } = useWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("report");
    if (p) setOpenId(p);
  }, []);
  if (!ws) return <Loading />;

  const runs = [
    ...ws.analyses.map((a) => ({
      id: a.id, kind: "analysis" as const, at: a.createdAt, status: a.status === "done" ? "✓" : a.status, spans: a.spans,
      info: t.traces.info(a.stats.mentions, a.stats.readings, a.stats.fallbacks), ms: a.latencyMs, error: a.error,
    })),
    ...ws.reports.map((r) => ({
      id: r.id, kind: "report" as const, at: r.createdAt, status: REPORT_STATUS_L[lang][r.status], spans: r.spans,
      info: `v${r.version ?? 1} · ${t.traces.reportInfo(r.claimIds.length, r.textSource === "template" ? t.reports.template : t.reports.attempts(r.writerAttempts))}`,
      ms: r.spans.reduce((s, x) => s + x.ms, 0), error: r.error,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.traces.title} sub={t.traces.sub} />
      <div className="space-y-3">
        {runs.length === 0 && <div className="card p-8 text-center text-sm text-muted">{t.traces.empty}</div>}
        {runs.map((r) => (
          <div key={r.id} className="card p-4">
            <button className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id}>
              <Pill cls={r.kind === "analysis" ? "bg-target-soft text-target-ink" : "bg-accent-soft text-accent-ink"}>{r.kind === "analysis" ? t.traces.analysis : t.traces.report}</Pill>
              <span className="text-sm font-bold">{r.info}</span>
              <span className="text-xs text-muted">{r.status}</span>
              <span className="tabular ml-auto text-xs text-ink-2">
                {fmtMs(r.ms)} · {fmtDate(r.at)}
              </span>
            </button>
            {r.error && <div className="mt-2 text-xs text-critical-ink">{r.error}</div>}
            {openId === r.id && (
              <div className="mt-3">
                <SpanList spans={r.spans} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
