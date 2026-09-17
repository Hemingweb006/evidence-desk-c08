"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Download, History, Lock, Printer, RefreshCw, ShieldAlert, ShieldCheck, UserCheck, X } from "lucide-react";
import { ApprovalStamp } from "@/components/ApprovalStamp";
import { PlanActualTable, ResultsChain } from "@/components/PlanActual";
import { Button, Loading, Pill, StatusBadge } from "@/components/ui";
import { api, errText, redraft, useWorkspace } from "@/components/workspace";
import { fmt } from "@/lib/engine/decide";
import { rowsNeedingJustification } from "@/lib/engine/plan-actual";
import { REPORT_STATUS_L, STATUS_L, claimView } from "@/lib/i18n/terms";
import type { Claim, Report } from "@/lib/types";

function ClaimChip({ c, stale }: { c: Claim | undefined; stale?: boolean }) {
  const { lang, t } = useWorkspace();
  const [open, setOpen] = useState(false);
  if (!c) return null;
  const v = claimView(c, lang);
  return (
    <span className="relative inline-block align-middle font-sans" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`mx-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold ${stale ? "bg-critical text-white" : "bg-accent-soft text-accent-ink"}`}
        title={stale ? t.report.staleChip : undefined}
      >
        {stale && "⚠ "}
        {c.id} · {c.evidenceId} · {c.period}
      </button>
      {open && (
        <span className="absolute left-0 top-6 z-20 w-72 rounded-[4px] border border-line bg-surface p-3 text-left text-xs font-normal shadow-lg">
          <span className="mb-1 flex items-center gap-2">
            <StatusBadge status={c.status} />
            <b className="tabular">{fmt(c.value)}</b> {c.value !== null && v.unit}
          </span>
          <span className="block text-ink-2">{v.label}</span>
          <span className="mt-1 block italic text-muted">“{c.quote}”</span>
          {stale && <span className="mt-1 block font-bold text-critical-ink">{t.report.staleTip}</span>}
        </span>
      )}
    </span>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { ws, refresh, t, lang, fmtDate, identity, setIdentity, me } = useWorkspace();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  if (!ws) return <Loading />;
  const r = ws.reports.find((x) => x.id === id);
  if (!r)
    return (
      <div className="text-sm text-muted">
        {t.common.notFound}{" "}
        <Link className="underline" href="/report">
          {t.common.back}
        </Link>
      </div>
    );
  const report: Report = r;
  const text = report.texts?.[lang] ?? report.texts?.de ?? { title: report.title, sections: report.sections, textSource: report.textSource, attempts: report.writerAttempts, problems: report.checkProblems };
  const byId = new Map(report.claimsSnapshot.map((c) => [c.id, c]));

  async function decide(decision: "approve" | "changes") {
    setError("");
    setBusy(decision);
    try {
      await api(`/api/reports/${id}/review`, "POST", { decision, reviewer: me, role: identity.role, note });
      setNote("");
      await refresh();
    } catch (e) {
      setError(errText(e));
      await refresh();
    } finally {
      setBusy("");
    }
  }

  async function doRedraft() {
    setError("");
    setBusy("redraft");
    try {
      await redraft(router, report.id);
    } catch (e) {
      setError(errText(e));
      setBusy("");
    }
  }

  const approved = report.status === "approved";
  const outdated = report.status === "outdated";
  const current = new Map(ws.claims.map((c) => [c.id, c]));
  const prevVersion = report.supersedes ? ws.reports.find((x) => x.id === report.supersedes) : undefined;
  const nextVersion = report.supersededBy ? ws.reports.find((x) => x.id === report.supersededBy) : undefined;
  const reviewable = report.status === "draft" && !report.supersededBy;
  const staleIds = new Set(outdated ? report.outdated?.changedClaimIds ?? [] : []);
  const replacementOf = (cid: string) => (ws.impacts ?? []).flatMap((i) => i.changes).find((ch) => ch.id === cid)?.replacedBy ?? [];
  const describe = (c: Claim) => {
    const v = claimView(c, lang);
    return `${v.label}: ${STATUS_L[lang][c.status]}${c.value !== null ? ` (${fmt(c.value)} ${v.unit})` : ""} — ${c.evidenceId}`;
  };
  const missingJust = rowsNeedingJustification(report.planActual).filter((row) => !report.deviationNotes?.[row.key]?.text.trim());
  const isReviewer = identity.role === "reviewer";
  const selfReview = isReviewer && !!report.preparedBy && me.toLowerCase() === report.preparedBy.trim().toLowerCase();
  const tplLangs = (["de", "en"] as const).filter((l) => report.texts?.[l]?.textSource === "template").map((l) => l.toUpperCase());
  const maxAttempts = Math.max(...(["de", "en"] as const).map((l) => report.texts?.[l]?.attempts ?? 1));
  const q = (s: string) => (lang === "de" ? `„${s}“` : `“${s}”`);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <Link href="/report" className="text-sm font-bold text-accent-ink hover:underline">
          {t.report.back}
        </Link>
        <div className="ml-auto flex gap-2">
          <a href={`/api/reports/${id}/markdown?lang=${lang}`}>
            <Button variant="ghost">
              <Download size={15} /> {t.report.markdown}
            </Button>
          </a>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer size={15} /> {t.report.print}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_21rem]">
        <article className="card relative overflow-hidden px-6 py-8 md:px-12" lang={lang}>
          {!approved && <div className="watermark">{outdated ? (lang === "de" ? "ÜBERHOLT" : "OUTDATED") : lang === "de" ? "ENTWURF" : "DRAFT"}</div>}
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {outdated ? (
                <Pill cls="bg-critical text-white">
                  <ShieldAlert size={12} /> {t.report.outdatedPill}
                </Pill>
              ) : approved ? (
                <Pill cls="bg-accent text-on-accent">
                  <ShieldCheck size={12} /> {t.report.approvedBy(report.review?.reviewer ?? "", fmtDate(report.review!.at))}
                </Pill>
              ) : report.status === "changes_requested" ? (
                <Pill cls="bg-critical-soft text-critical-ink">{t.report.changesBy(report.review?.reviewer ?? "")}</Pill>
              ) : report.status === "error" ? (
                <Pill cls="bg-critical-soft text-critical-ink">{t.report.error(report.error ?? "")}</Pill>
              ) : (
                <Pill cls="bg-warning-soft text-warning-ink">{t.report.draftPill}</Pill>
              )}
              <span className="text-muted">{t.report.notice}</span>
            </div>
            <div className="mt-5 text-xs font-bold uppercase tracking-wider text-accent-ink">
              {t.report.preparedFor} {ws.client ?? "Schmitz-Stiftungen"}
            </div>
            <h1 className="mt-1 text-[30px] font-normal leading-tight text-accent">{text.title || t.report.defaultTitle}</h1>
            <div className="mt-1 text-sm text-ink-2">
              {ws.caseName} · {t.report.meta(report.period, report.claimIds.length, report.version ?? 1)}
              {report.preparedBy ? ` · ${t.report.preparedBy(report.preparedBy)}` : ""}
            </div>
            {(prevVersion || nextVersion) && (
              <div className="no-print mt-1 flex flex-wrap gap-3 text-xs">
                {prevVersion && (
                  <Link className="text-accent-ink hover:underline" href={`/report/${prevVersion.id}`}>
                    {t.report.replaces(prevVersion.version ?? 1, REPORT_STATUS_L[lang][prevVersion.status])}
                  </Link>
                )}
                {nextVersion && (
                  <Link className="font-bold text-accent-ink hover:underline" href={`/report/${nextVersion.id}`}>
                    {t.report.replacedBy(nextVersion.version ?? 1, REPORT_STATUS_L[lang][nextVersion.status])}
                  </Link>
                )}
              </div>
            )}

            {outdated && report.outdated && (
              <div className="mt-5 rounded-[4px] border border-critical/50 bg-critical-soft p-4 text-sm" data-testid="outdated-box">
                <div className="font-bold text-critical-ink">{t.report.outdatedTitle}</div>
                <div className="mt-1 text-ink-2">
                  {lang === "de" ? report.outdated.triggerDe ?? report.outdated.trigger : report.outdated.trigger} · {fmtDate(report.outdated.at)}.{" "}
                  {report.outdated.previousStatus === "approved" ? t.report.outdatedApproved(report.review?.reviewer ?? "—") : t.report.outdatedDraft}
                </div>
                <table className="mt-3 w-full text-xs">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-1 pr-2">{t.report.colClaim}</th>
                      <th className="pr-2">{t.report.colInReport}</th>
                      <th>{t.report.colNow}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.outdated.changedClaimIds.map((cid) => {
                      const was = byId.get(cid);
                      const now = current.get(cid);
                      const repl = replacementOf(cid);
                      return (
                        <tr key={cid} className="border-t border-critical/20 align-top">
                          <td className="py-1.5 pr-2 font-bold">{cid}</td>
                          <td className="pr-2">{was ? describe(was) : "—"}</td>
                          <td className="font-bold">
                            {now
                              ? describe(now)
                              : repl.length
                                ? t.report.noLongerArrow(
                                    repl
                                      .map((x) => {
                                        const n = current.get(x);
                                        return n ? `${x} ${describe(n)}` : x;
                                      })
                                      .join("; "),
                                  )
                                : t.report.noLonger}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {report.planActual && (
              <div className="mt-8 space-y-5 rounded-[4px] border border-line p-4">
                <PlanActualTable pa={report.planActual} reportId={report.id} notes={report.deviationNotes} editable={reviewable} />
                <ResultsChain pa={report.planActual} />
              </div>
            )}

            <div className="report-doc mt-8 space-y-8 text-[16px] leading-8">
              {text.sections
                .filter((s) => s.paragraphs.length)
                .map((s) => (
                  <section key={s.key}>
                    <h2 className="mb-2 border-b border-line pb-1 text-sm font-bold uppercase tracking-wider text-ink-2">{s.title}</h2>
                    {s.key === "questions" ? (
                      <ol className="list-decimal space-y-1 pl-5">
                        {s.paragraphs.map((p, i) => (
                          <li key={i}>
                            {p.text}{" "}
                            {p.claimIds.map((cid) => (
                              <ClaimChip key={cid} c={byId.get(cid)} stale={staleIds.has(cid)} />
                            ))}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      s.paragraphs.map((p, i) => (
                        <p
                          key={i}
                          className={`mb-2 ${s.key === "method" ? "text-[14px] leading-6 text-ink-2" : ""} ${s.key === "do_not_report" ? "border-l-[3px] border-critical pl-3" : ""}`}
                        >
                          {p.text}{" "}
                          {p.claimIds.map((cid) => (
                            <ClaimChip key={cid} c={byId.get(cid)} stale={staleIds.has(cid)} />
                          ))}
                        </p>
                      ))
                    )}
                  </section>
                ))}

              <section className="font-sans">
                <h2 className="mb-2 border-b border-line pb-1 text-sm font-bold uppercase tracking-wider text-ink-2">{t.report.appendix}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-xs leading-5">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="py-1 pr-2">{t.report.colClaim}</th>
                        <th className="pr-2">{t.report.colStatus}</th>
                        <th className="pr-2">{t.report.colValue}</th>
                        <th className="pr-2">{t.report.colMeaning}</th>
                        <th className="pr-2">{t.report.colEvidence}</th>
                        <th>{t.report.colQuote}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.claimsSnapshot.map((c) => {
                        const v = claimView(c, lang);
                        return (
                          <tr key={c.id} className="border-t border-line align-top">
                            <td className="py-1.5 pr-2 font-bold">{c.id}</td>
                            <td className="pr-2">
                              <StatusBadge status={c.status} />
                            </td>
                            <td className="tabular pr-2">
                              {fmt(c.value)} {c.value !== null && v.unit}
                            </td>
                            <td className="pr-2">{v.label}</td>
                            <td className="pr-2">{c.evidenceId}</td>
                            <td className="italic text-ink-2">“{c.quote}”</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-muted">{t.report.langNote(lang === "de" ? "Deutsch" : "English")}</div>
              </section>
            </div>

            <ApprovalStamp r={report} />
          </div>
        </article>

        <aside className="no-print space-y-4">
          <div className="card p-4" data-testid="approval-box">
            <div className="mb-2 flex items-center gap-1.5 text-[15px] font-bold">
              <UserCheck size={16} className="text-accent" /> {t.report.approval}
            </div>
            {outdated ? (
              <div className="space-y-2" data-testid="review-blocked">
                <div className="flex items-center gap-1.5 text-sm font-bold text-critical-ink">
                  <Lock size={14} /> {t.report.blocked}
                </div>
                <p className="text-xs text-ink-2">{t.report.blockedBody(report.outdated?.changedClaimIds.join(", ") ?? "")}</p>
                {nextVersion ? (
                  <Link href={`/report/${nextVersion.id}`}>
                    <Button className="w-full">{t.report.openV(nextVersion.version ?? 1, REPORT_STATUS_L[lang][nextVersion.status])}</Button>
                  </Link>
                ) : (
                  <Button className="w-full" onClick={doRedraft} disabled={!!busy}>
                    <RefreshCw size={15} /> {t.report.redraftCurrent}
                  </Button>
                )}
                {error && <div className="text-xs text-critical-ink">{error}</div>}
                {report.review && (
                  <div className="border-t border-line pt-2 text-xs text-muted">
                    {t.report.historyLine(report.review.decision === "approve" ? t.report.approvedWord : t.report.changesWord, report.review.reviewer, fmtDate(report.review.at))}
                  </div>
                )}
              </div>
            ) : reviewable ? (
              <div className="space-y-2">
                <p className="text-xs text-ink-2">{t.report.paused}</p>
                {!isReviewer ? (
                  <div className="space-y-2 rounded-[3px] bg-warning-soft p-2 text-xs text-warning-ink" data-testid="officer-cannot">
                    <div>{t.report.officerCannot(report.preparedBy ?? "—")}</div>
                    <Button variant="ghost" className="w-full text-xs" onClick={() => setIdentity({ ...identity, role: "reviewer" })}>
                      {t.report.switchToReviewer}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-ink-2">{t.report.asReviewer(me)}</div>
                    {selfReview && <div className="rounded-[3px] bg-critical-soft p-2 text-xs text-critical-ink">{t.report.sameName(me)}</div>}
                    {missingJust.length > 0 && <div className="rounded-[3px] bg-critical-soft p-2 text-xs text-critical-ink">{t.report.needsJustification}</div>}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder={t.report.notePh}
                      aria-label={t.report.notePh}
                      className="w-full rounded-[3px] border border-line bg-surface px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => decide("approve")} disabled={!!busy || me.length < 2}>
                        <Check size={15} /> {t.report.approve}
                      </Button>
                      <Button variant="danger" onClick={() => decide("changes")} disabled={!!busy || me.length < 2}>
                        <X size={15} /> {t.report.requestChanges}
                      </Button>
                    </div>
                  </>
                )}
                {error && <div className="rounded-[3px] bg-critical-soft p-2 text-xs text-critical-ink" data-testid="review-error">{error}</div>}
              </div>
            ) : report.review && !nextVersion ? (
              <div className="text-sm">
                <div>
                  {report.review.decision === "approve" ? t.report.approvedWord : t.report.changesWord} · <b>{report.review.reviewer}</b>
                </div>
                {report.review.note && <div className="mt-1 text-xs text-ink-2">{q(report.review.note)}</div>}
                {report.review.decision === "changes" && (
                  <Button className="mt-3 w-full" onClick={doRedraft} disabled={!!busy}>
                    <RefreshCw size={15} /> {t.report.redraftRule}
                  </Button>
                )}
                {error && <div className="mt-2 text-xs text-critical-ink">{error}</div>}
              </div>
            ) : nextVersion ? (
              <div className="text-xs text-muted">
                {t.report.replacedNotice(nextVersion.version ?? 1)}{" "}
                <Link className="underline" href={`/report/${nextVersion.id}`}>
                  {t.report.openVersion(nextVersion.version ?? 1)}
                </Link>
              </div>
            ) : (
              <div className="text-xs text-muted">{t.report.notReviewable}</div>
            )}
          </div>

          <div className="card p-4 text-xs">
            <div className="mb-2 text-[15px] font-bold">{t.report.checks}</div>
            <ul className="space-y-1">
              <li className="flex gap-1.5">
                <Check size={13} className="text-good-ink" /> {t.report.sawOnly(report.claimIds.length)}
              </li>
              <li className="flex gap-1.5">
                {tplLangs.length === 0 ? <Check size={13} className="text-good-ink" /> : <X size={13} className="text-critical-ink" />}
                {tplLangs.length ? t.report.templateUsed(tplLangs.join(", ")) : maxAttempts > 1 ? t.report.passedAfter(maxAttempts) : t.report.passedFirst}
              </li>
              <li className="flex gap-1.5">
                <Check size={13} className="text-good-ink" /> {t.report.chipsOk}
              </li>
            </ul>
            {(text.problems ?? []).length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted">{t.report.rejected}</summary>
                <ul className="mt-1 list-disc pl-4 text-ink-2">
                  {text.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>
            )}
            <Link href={`/traces?report=${report.id}`} className="mt-3 inline-block font-bold text-accent-ink hover:underline">
              {t.report.viewTrace}
            </Link>
          </div>

          <div className="card p-4 text-xs">
            <div className="mb-2 flex items-center gap-1.5 text-[15px] font-bold">
              <History size={15} /> {t.report.history}
            </div>
            <ol className="space-y-1.5" data-testid="audit-trail">
              {(report.history ?? []).map((h, i) => (
                <li key={i} className="border-l-2 border-line pl-2">
                  <div>
                    <b>{h.who}</b> <span className="text-muted">({t.report.roles[h.role]})</span> {t.report.action[h.action]}
                  </div>
                  {(h.note || h.noteDe) && <div className="text-ink-2">{lang === "de" ? h.noteDe ?? h.note : h.note}</div>}
                  <div className="text-muted">{fmtDate(h.at)}</div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-4 text-xs">
            <div className="mb-2 text-[15px] font-bold">{t.report.rulesApplied}</div>
            <ul className="space-y-1 text-ink-2">
              {ws.rules
                .filter((x) => report.rulesApplied.includes(x.id))
                .map((x) => (
                  <li key={x.id}>
                    <b>{x.id}</b> {lang === "de" ? x.textDe ?? x.text : x.text}
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
