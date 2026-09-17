"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Compass, FlaskConical, Loader2, MessageSquarePlus, RefreshCw, RotateCcw } from "lucide-react";
import { applyStepEvent, Pipeline, type Step } from "@/components/Pipeline";
import { nextAction, type NextAction } from "@/lib/next-action";
import { REPORT_STATUS_L, STATUS_HINT_L, STATUS_L } from "@/lib/i18n/terms";
import type { UIDict } from "@/lib/i18n/ui";
import type { ClaimStatus } from "@/lib/types";
import { Button, Loading, PageHeader, Pill, STATUS_STYLE, SimulatedTag, StatTile } from "@/components/ui";
import { api, errText, postStream, redraft, useWorkspace } from "@/components/workspace";

const STATUSES: ClaimStatus[] = ["VERIFIED", "TARGET", "UNCERTAIN", "UNKNOWN", "MISLEADING"];

const PACKS = ["french_pack", "german_pack"];

const TONE: Record<string, string> = {
  accent: "border-accent/40 bg-accent-soft",
  warning: "border-warning/60 bg-warning-soft",
  critical: "border-critical/50 bg-critical-soft",
  good: "border-good/40 bg-good-soft",
};

function nextText(n: NextAction, t: UIDict) {
  const rowName = (k: string) => t.pa.row[k] ?? k;
  switch (n.kind) {
    case "analyse":
      return { title: t.next.analyse.title, body: t.next.analyse.body(n.n ?? 0), cta: t.next.analyse.cta };
    case "reanalyse":
      return { title: t.next.reanalyse.title, body: t.next.reanalyse.body(n.ids ?? ""), cta: t.next.reanalyse.cta };
    case "outdated":
      return { title: t.next.outdated.title(n.v ?? ""), body: t.next.outdated.body(n.ids ?? "", !!n.wasApproved), cta: t.next.outdated.cta };
    case "justify":
      return { title: t.next.justify.title(n.v ?? ""), body: t.next.justify.body((n.rows ?? []).map(rowName).join(", ")), cta: t.next.justify.cta };
    case "review":
      return { title: t.next.review.title(n.v ?? ""), body: t.next.review.body, cta: t.next.review.cta };
    case "cleanBag":
      return { title: t.next.cleanBag.title, body: t.next.cleanBag.body(n.ids ?? ""), cta: t.next.cleanBag.cta };
    case "redraftRule":
      return { title: t.next.redraftRule.title, body: t.next.redraftRule.body(n.name ?? "—"), cta: t.next.redraftRule.cta };
    case "approved":
      return { title: t.next.approved.title(n.v ?? ""), body: t.next.approved.body(n.name ?? "—"), cta: t.next.approved.cta };
    case "push":
      return { title: t.next.push.title, body: t.next.push.body(n.n ?? 0), cta: t.next.push.cta };
    case "choose":
      return { title: t.next.choose.title, body: t.next.choose.body(n.n ?? 0), cta: t.next.choose.cta };
  }
}

export default function Overview() {
  const { ws, refresh, setBagOpen, t, lang, fmtDate } = useWorkspace();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState({ who: "", kind: "pain" as "pain" | "feedback" | "change", note: "" });
  const [simSteps, setSimSteps] = useState<Step[]>([]);
  const [simMsg, setSimMsg] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  if (!ws) return <Loading />;
  const next = nextAction(ws);
  const nt = nextText(next, t);

  const last = ws.analyses[0];
  const report = ws.reports[0];
  const stale = last && ws.evidence.some((e) => !last.evidenceIds.includes(e.id));
  const count = (s: ClaimStatus) => ws.claims.filter((c) => c.status === s).length;

  async function runSimulation(key: string, label: string) {
    setBusy(key);
    setErr("");
    setSimSteps([]);
    setSimMsg(t.overview.simRunning(label));
    try {
      await postStream(
        "/api/simulate",
        (e) => {
          if (e.type === "step_start" || e.type === "step_end") setSimSteps((s) => applyStepEvent(s, e as never));
          if (e.type === "impact") {
            const imp = e.impact as { changes: { inBag: boolean; reportIds: string[] }[]; outdatedReportIds: string[]; newClaimIds: string[] } | null;
            const sel = imp ? imp.changes.filter((c) => c.inBag || c.reportIds.length).length : 0;
            setSimMsg(imp ? t.overview.simDone(imp.newClaimIds.length, sel, imp.outdatedReportIds.length) : t.overview.simNone);
          }
          if (e.type === "error") setErr(String(e.message));
        },
        { key },
      );
    } catch (e) {
      setErr(errText(e));
    }
    await refresh();
    setBusy("");
  }

  const steps = [
    {
      n: 1, title: t.overview.step1.title, href: "/sources",
      body: t.overview.step1.body(ws.evidence.length, ws.evidence.some((e) => e.origin === "simulated")),
      cta: stale || !last ? t.overview.step1.ctaAnalyse : t.overview.step1.ctaAdd,
    },
    {
      n: 2, title: t.overview.step2.title, href: "/claims",
      body: ws.claims.length ? t.overview.step2.body(ws.claims.length, count("MISLEADING")) : t.overview.step2.empty,
      cta: t.overview.step2.cta,
    },
    { n: 3, title: t.overview.step3.title, href: "#bag", body: t.overview.step3.body(ws.bag.length), cta: t.overview.step3.cta },
    {
      n: 4, title: t.overview.step4.title, href: report ? `/report/${report.id}` : "/report",
      body: report ? t.overview.step4.body(REPORT_STATUS_L[lang][report.status]) : t.overview.step4.empty,
      cta: report ? t.overview.step4.ctaOpen : t.overview.step4.ctaGo,
    },
  ];

  async function reset() {
    if (!confirm(t.overview.resetConfirm)) return;
    setBusy("reset");
    await api("/api/reset", "POST");
    await refresh();
    setSimMsg("");
    setSimSteps([]);
    setBusy("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t.overview.title}
        sub={t.overview.sub}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={reset} disabled={!!busy}>
              <RotateCcw size={15} /> {t.overview.reset}
            </Button>
            <Link href="/sources">
              <Button>
                {t.overview.start} <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        }
      />

      <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-[4px] border p-4 ${TONE[next.tone]}`} data-testid="next-action">
        <Compass size={22} className="shrink-0 text-ink-2" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{t.next.label}</div>
          <div className="text-[17px] font-bold">{nt.title}</div>
          <div className="text-sm text-ink-2">{nt.body}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {next.redraftId && (
            <Button
              disabled={!!busy}
              onClick={async () => {
                setBusy("redraft");
                try {
                  await redraft(router, next.redraftId!);
                } catch (e) {
                  setErr(errText(e));
                  setBusy("");
                }
              }}
            >
              <RefreshCw size={15} /> {t.next.redraftNow}
            </Button>
          )}
          {next.href === "#bag" ? (
            <Button variant={next.redraftId ? "ghost" : "primary"} onClick={() => setBagOpen(true)}>
              {nt.cta}
            </Button>
          ) : next.href ? (
            <Link href={next.href}>
              <Button variant={next.redraftId ? "ghost" : "primary"}>
                {nt.cta} <ArrowRight size={15} />
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      {err && <div className="mb-3 rounded-[3px] bg-critical-soft px-3 py-2 text-sm text-critical-ink">{err}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n} className="card flex flex-col p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{s.n}</span>
              <span className="text-[15px] font-bold">{s.title}</span>
            </div>
            <div className="mt-2 flex-1 text-sm text-ink-2">{s.body}</div>
            {s.href === "#bag" ? (
              <button onClick={() => setBagOpen(true)} className="mt-3 text-left text-sm font-bold text-accent-ink hover:underline">
                {s.cta} →
              </button>
            ) : (
              <Link href={s.href} className="mt-3 text-sm font-bold text-accent-ink hover:underline">
                {s.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {stale && (
        <div className="mt-3 rounded-[3px] bg-warning-soft px-4 py-2 text-sm text-warning-ink">
          {t.overview.stale}{" "}
          <Link href="/sources" className="font-bold underline">
            {t.overview.staleLink}
          </Link>{" "}
          {t.overview.staleTail}
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="card p-4">
          <div className="mb-3 text-[15px] font-bold">{t.overview.byStatus}</div>
          {ws.claims.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted">{t.overview.byStatusEmpty}</div>
          ) : (
            <ul className="space-y-2">
              {STATUSES.map((s) => {
                const n = count(s);
                const max = Math.max(...STATUSES.map(count), 1);
                return (
                  <li key={s} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-2 text-xs" title={STATUS_HINT_L[lang][s]}>
                    <span className="text-ink-2">{STATUS_L[lang][s]}</span>
                    <span className="relative h-5 rounded-[2px]">
                      <span className="absolute inset-y-0 left-0 rounded-r-[2px]" style={{ width: `${(n / max) * 100}%`, minWidth: n ? 3 : 0, background: STATUS_STYLE[s].bar }} />
                    </span>
                    <span className="tabular text-right">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="grid gap-3">
          <StatTile
            label={t.overview.lastAnalysis}
            value={last ? `${(last.latencyMs / 1000).toFixed(1).replace(".", lang === "de" ? "," : ".")} s` : "—"}
            hint={last ? t.overview.lastAnalysisHint(last.stats.mentions, last.stats.readings, fmtDate(last.createdAt)) : t.overview.notRun}
          />
          <StatTile label={t.overview.rules} value={ws.rules.filter((r) => r.active).length} hint={t.overview.rulesHint} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-[15px] font-bold">
            <FlaskConical size={15} /> {t.overview.simTitle}
          </div>
          <p className="mb-3 text-xs text-muted">{t.overview.simDesc}</p>
          <div className="space-y-2">
            {ws.simulations.map((s) => {
              const label = lang === "de" ? s.labelDe : s.label;
              return (
                <div key={s.key} className="flex items-center gap-3 rounded-[3px] border border-line p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      {label} <SimulatedTag />
                    </div>
                    <div className="text-xs text-muted">{lang === "de" ? s.descriptionDe : s.description}</div>
                  </div>
                  <Button
                    variant="soft"
                    disabled={(s.added && !PACKS.includes(s.key)) || !!busy}
                    onClick={async () => {
                      if (PACKS.includes(s.key) && !confirm(t.overview.frenchConfirm)) return;
                      await runSimulation(s.key, label);
                    }}
                  >
                    {busy === s.key ? <Loader2 size={14} className="animate-spin" /> : null}
                    {busy === s.key ? t.overview.running : s.added && !PACKS.includes(s.key) ? t.overview.added : t.overview.simulate}
                  </Button>
                </div>
              );
            })}
          </div>
          {(simMsg || simSteps.length > 0) && (
            <div className="mt-3 rounded-[3px] border border-line p-3" data-testid="sim-progress">
              <div className="mb-2 text-xs text-ink-2">{simMsg}</div>
              {simSteps.length > 0 && <Pipeline steps={simSteps} running={!!busy} />}
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-[15px] font-bold">
            <MessageSquarePlus size={15} /> {t.overview.logTitle}
          </div>
          <p className="mb-3 text-xs text-muted">{t.overview.logDesc}</p>
          <form
            className="grid gap-2 sm:grid-cols-[7.5rem_7rem_1fr_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/feedback", "POST", note);
              setNote({ ...note, note: "" });
              await refresh();
            }}
          >
            <select
              aria-label="kind"
              value={note.kind}
              onChange={(e) => setNote({ ...note, kind: e.target.value as typeof note.kind })}
              className="rounded-[3px] border border-line bg-surface px-2 py-2 text-sm"
            >
              <option value="pain">{t.overview.kind.pain}</option>
              <option value="feedback">{t.overview.kind.feedback}</option>
              <option value="change">{t.overview.kind.change}</option>
            </select>
            <input aria-label={t.overview.who} value={note.who} onChange={(e) => setNote({ ...note, who: e.target.value })} placeholder={t.overview.who} className="rounded-[3px] border border-line bg-surface px-2 py-2 text-sm" />
            <input aria-label={t.overview.what} value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} placeholder={t.overview.what} className="rounded-[3px] border border-line bg-surface px-2 py-2 text-sm" />
            <Button type="submit" disabled={!note.who || note.note.length < 3}>
              {t.overview.log}
            </Button>
          </form>
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-xs">
            {[...ws.feedbackLog].reverse().map((f, i) => (
              <li key={i} className="flex gap-2">
                <Pill cls={f.kind === "pain" ? "bg-critical-soft text-critical-ink" : f.kind === "change" ? "bg-accent-soft text-accent-ink" : "bg-target-soft text-target-ink"}>
                  {t.overview.kind[f.kind]}
                </Pill>
                <span className="min-w-0 flex-1">
                  <b>{f.who}</b> — {lang === "de" ? f.noteDe ?? f.note : f.note}
                </span>
                <span className="shrink-0 text-muted">{fmtDate(f.at)}</span>
              </li>
            ))}
            {ws.feedbackLog.length === 0 && <li className="text-muted">{t.overview.logEmpty}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
