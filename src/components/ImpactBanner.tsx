"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BellRing, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { REPORT_STATUS_L, STATUS_L } from "@/lib/i18n/terms";
import { latestVersion, openImpact, reportName } from "@/lib/next-action";
import type { ClaimSnapshotLite } from "@/lib/types";
import { Button, Pill } from "./ui";
import { errText, redraft, useWorkspace } from "./workspace";

/** Bandeau global : quel Beleg nachgereicht a rendu obsolètes des claims choisis, et quels rapports doivent être revus. */
export function ImpactBanner() {
  const { ws, t, lang } = useWorkspace();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!ws) return null;
  const imp = openImpact(ws);
  if (!imp) return null;
  const show = (s?: ClaimSnapshotLite) =>
    s ? `${lang === "de" ? s.labelDe ?? s.label : s.label}: ${STATUS_L[lang][s.status]}${s.value !== null ? ` (${s.value})` : ""}` : "—";
  const selected = imp.changes.filter((c) => c.inBag || c.reportIds.length);
  const reports = imp.outdatedReportIds.map((id) => ws.reports.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  const toRedraft = reports.find((r) => latestVersion(ws, r).id === r.id);
  const pendingNew = reports.map((r) => latestVersion(ws, r)).find((v) => v.status === "draft");
  const trigger = lang === "de" ? imp.triggerDe ?? imp.trigger : imp.trigger;

  return (
    <section className="no-print mb-5 rounded-[4px] border border-critical/40 bg-critical-soft p-4" aria-live="polite" data-testid="impact-banner">
      <div className="flex flex-wrap items-center gap-2">
        <BellRing size={16} className="text-critical-ink" />
        <b className="text-[15px] text-critical-ink">{t.impact.title}</b>
        {imp.simulated && <Pill cls="border border-dashed border-warning bg-surface text-warning-ink">{t.impact.simulatedEvent}</Pill>}
        <span className="text-xs text-ink-2">
          {trigger} · {imp.newEvidenceIds.join(", ") || t.impact.reanalysis}
        </span>
        <button className="ml-auto inline-flex items-center gap-1 text-xs text-ink-2 hover:underline" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {open ? t.impact.hide : t.impact.show}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-2">{t.impact.selected(selected.length)}</div>
            <ul className="space-y-1.5 text-sm">
              {selected.map((c) => (
                <li key={c.id} className="rounded-[3px] bg-surface px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{c.id}</b>
                    <span className="text-ink-2 line-through decoration-critical/60">{show(c.before)}</span>
                    <ArrowRight size={13} className="text-muted" />
                    {c.kind === "removed" ? (
                      <span className="font-bold text-critical-ink">
                        {t.impact.noLonger}
                        {c.replacedBy.length ? t.impact.replacedBy(c.replacedBy.join(", ")) : ""}
                      </span>
                    ) : (
                      <span className="font-bold">{show(c.after)}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {t.impact.wasFrom(c.before.evidenceId)} · {[c.inBag && t.impact.inBag, c.reportIds.length && t.impact.usedBy(c.reportIds.length)].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
              {selected.length === 0 && <li className="text-xs text-muted">{t.impact.noneSelected}</li>}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-2">{t.impact.reports}</div>
            <ul className="space-y-1.5 text-sm">
              {reports.map((r) => {
                const v = latestVersion(ws, r);
                return (
                  <li key={r.id} className="rounded-[3px] bg-surface px-3 py-2">
                    <Link href={`/report/${r.id}`} className="font-bold hover:underline">
                      {t.impact.reportName(reportName(r))}
                    </Link>
                    <span className="ml-1 text-xs text-muted">· {t.impact.claimsCount(r.claimIds.length)}</span>
                    <div className="text-xs text-ink-2">
                      {r.outdated?.previousStatus === "approved" ? t.impact.wasApproved(r.review?.reviewer ?? "—") : t.impact.was(r.outdated ? REPORT_STATUS_L[lang][r.outdated.previousStatus] : "")}
                      {v.id !== r.id && (
                        <>
                          {" "}
                          · {t.impact.newVersion}{" "}
                          <Link className="underline" href={`/report/${v.id}`}>
                            v{v.version}
                          </Link>{" "}
                          {t.impact.is} {REPORT_STATUS_L[lang][v.status]}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
              {reports.length === 0 && <li className="text-xs text-muted">{t.impact.noReports}</li>}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {toRedraft && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await redraft(router, toRedraft.id);
                    } catch (e) {
                      setError(errText(e));
                      setBusy(false);
                    }
                  }}
                >
                  <RefreshCw size={15} /> {t.impact.redraft}
                </Button>
              )}
              {!toRedraft && pendingNew && path !== `/report/${pendingNew.id}` && (
                <Link href={`/report/${pendingNew.id}`}>
                  <Button>
                    {t.impact.reviewV(`v${pendingNew.version}`)} <ArrowRight size={15} />
                  </Button>
                </Link>
              )}
            </div>
            {error && <div className="mt-2 text-xs text-critical-ink">{error}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
