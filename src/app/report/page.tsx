"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, Send } from "lucide-react";
import { applyStepEvent, Pipeline, type Step } from "@/components/Pipeline";
import { REPORT_STATUS_L } from "@/lib/i18n/terms";
import { Button, Loading, PageHeader, Pill } from "@/components/ui";
import { errText, postStream, useWorkspace } from "@/components/workspace";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-warning-soft text-warning-ink",
  approved: "bg-accent-soft text-accent-ink",
  changes_requested: "bg-critical-soft text-critical-ink",
  writing: "bg-target-soft text-target-ink",
  error: "bg-critical-soft text-critical-ink",
  outdated: "bg-critical text-white",
};

export default function ReportsPage() {
  const { ws, refresh, setBagOpen, t, lang, fmtDate, identity, me } = useWorkspace();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const isOfficer = identity.role === "officer";

  async function generate(supersedes?: string, preparedBy?: string) {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setError("");
    let reportId = "";
    try {
      await postStream(
        supersedes ? `/api/reports?supersedes=${encodeURIComponent(supersedes)}` : "/api/reports",
        (e) => {
          if (e.type === "step_start" || e.type === "step_end") setSteps((s) => applyStepEvent(s, e as never));
          if (e.type === "report") reportId = (e.report as { id: string }).id;
          if (e.type === "error") setError(String(e.message));
        },
        { preparedBy: preparedBy ?? me },
      );
    } catch (err) {
      setError(errText(err));
    }
    await refresh();
    setRunning(false);
    if (reportId) router.push(`/report/${reportId}`);
  }

  useEffect(() => {
    if (started.current) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("generate") === "1") {
      started.current = true;
      window.history.replaceState(null, "", "/report");
      // la personne qui crée le brouillon est la personne « Projektreferent:in » de la session
      const stored = (() => {
        try {
          return JSON.parse(window.localStorage.getItem("ed.identity") ?? "null") as { names?: { officer?: string } } | null;
        } catch {
          return null;
        }
      })();
      generate(q.get("supersedes") ?? undefined, stored?.names?.officer ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ws) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.reports.title}
        sub={t.reports.sub}
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setBagOpen(true)}>
              {t.reports.bag(ws.bag.length)}
            </Button>
            <Button onClick={() => generate()} disabled={running || !ws.bag.length || !isOfficer} title={isOfficer ? undefined : t.bag.switchOfficer}>
              <Send size={15} /> {t.reports.generate}
            </Button>
          </div>
        }
      />

      {(running || steps.length > 0) && (
        <div className="card mb-4 p-4">
          <div className="mb-2 text-[15px] font-bold">{t.reports.pipeline}</div>
          <Pipeline steps={steps} running={running} />
          {running && <div className="mt-2 text-xs text-muted">{t.reports.writing(ws.models.writer)}</div>}
        </div>
      )}
      {error && <div className="mb-4 rounded-[3px] bg-critical-soft px-3 py-2 text-sm text-critical-ink">{error}</div>}

      <div className="card divide-y divide-line">
        {ws.reports.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted">
            {t.reports.empty1}{" "}
            <Link href="/claims" className="text-accent-ink underline">
              {t.reports.claimsLink}
            </Link>{" "}
            {t.reports.empty2}
          </div>
        )}
        {ws.reports.map((r) => {
          const title = r.texts?.[lang]?.title || r.title || t.reports.untitled;
          return (
            <Link key={r.id} href={`/report/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <FileText size={16} className="text-ink-2" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">
                  <span className="mr-1.5 font-normal text-muted">v{r.version ?? 1}</span>
                  {title}
                </div>
                <div className="text-xs text-muted">
                  {[
                    t.reports.meta(r.claimIds.length),
                    r.preparedBy && t.reports.by(r.preparedBy),
                    r.supersededBy && t.reports.replaced,
                    r.outdated && t.reports.outdatedBy(r.outdated.changedClaimIds.join(", ")),
                    r.textSource === "template" ? t.reports.template : t.reports.attempts(r.writerAttempts),
                    fmtDate(r.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <Pill cls={STATUS_CLS[r.status] ?? ""}>
                {r.status === "outdated" && r.supersededBy ? t.reports.outdatedReplaced : REPORT_STATUS_L[lang][r.status]}
              </Pill>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
