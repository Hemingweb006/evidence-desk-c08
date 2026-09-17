"use client";

import type { Report } from "@/lib/types";
import { useWorkspace } from "./workspace";

/** Prüfvermerk (Vier-Augen-Prinzip) : imprimé avec le rapport. */
export function ApprovalStamp({ r }: { r: Report }) {
  const { t, fmtDate } = useWorkspace();
  const approved = r.status === "approved" && r.review?.decision === "approve";
  const invalid = r.status === "outdated" && r.review?.decision === "approve";
  const evidenceIds = [...new Set(r.claimsSnapshot.map((c) => c.evidenceId))];
  const stampColor = approved ? "var(--accent)" : invalid ? "var(--critical)" : "var(--muted)";
  return (
    <section className="print-break-avoid mt-10 rounded-[3px] border border-line bg-page p-5 font-sans" data-testid="approval-stamp">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2 text-[13px] leading-5">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-2">
            {t.stamp.title} · {t.stamp.subtitle}
          </div>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[11rem_1fr]">
            <span className="text-muted">{t.stamp.preparedBy}</span>
            <span>
              <b>{r.preparedBy ?? "—"}</b> · {fmtDate(r.createdAt)}
            </span>
            <span className="text-muted">{t.stamp.approvedBy}</span>
            <span>
              {r.review?.decision === "approve" ? (
                <>
                  <b className={invalid ? "line-through" : ""}>{r.review.reviewer}</b> · {fmtDate(r.review.at)}
                </>
              ) : (
                <span className="inline-block min-w-48 border-b border-dotted border-line-strong text-muted">{t.stamp.pending}</span>
              )}
            </span>
            <span className="text-muted">{t.stamp.version}</span>
            <span>v{r.version ?? 1}</span>
            <span className="text-muted">{t.stamp.basis}</span>
            <span>{t.stamp.basisValue(r.claimIds.length, evidenceIds.length, evidenceIds.join(", "))}</span>
            <span className="text-muted">{t.stamp.fingerprint}</span>
            <span className="tabular font-mono text-[12px]">{r.review?.fingerprint ?? "—"}</span>
          </div>
        </div>
        <div
          className="stamp shrink-0 rounded-[4px] px-4 py-2 text-center font-black uppercase tracking-widest"
          style={{ ["--stamp" as string]: stampColor }}
          aria-label={approved ? t.stamp.approved : invalid ? t.stamp.invalid : t.stamp.draft}
        >
          <div className="text-lg leading-6">{approved ? t.stamp.approved : invalid ? t.stamp.invalid : t.stamp.draft}</div>
          {invalid && r.outdated && <div className="text-[10px] font-bold normal-case tracking-normal">{t.stamp.invalidSince(fmtDate(r.outdated.at))}</div>}
          {approved && r.review && <div className="text-[10px] font-bold normal-case tracking-normal">{fmtDate(r.review.at)}</div>}
        </div>
      </div>
    </section>
  );
}
