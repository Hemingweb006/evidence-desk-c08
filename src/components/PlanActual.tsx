"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Ban, CheckCircle2, CircleDashed, CircleHelp } from "lucide-react";
import type { ChainLevel, PlanActual, PlanActualRow } from "@/lib/types";
import { Button, Pill } from "./ui";
import { api, errText, useWorkspace } from "./workspace";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function DeviationCell({ row, lang }: { row: PlanActualRow; lang: "de" | "en" }) {
  if (!row.deviation) return <span className="text-muted">—</span>;
  const { abs, pct } = row.deviation;
  const pctText = `${signed(pct)} %`;
  return (
    <span className={`tabular whitespace-nowrap font-bold ${row.needsJustification ? "text-critical-ink" : "text-ink"}`}>
      {signed(abs)} ({lang === "de" ? pctText.replace(".", ",") : pctText.replace(" ", "\u00a0")})
    </span>
  );
}

/** Soll-Ist-Vergleich : tableau calculé par le code, avec la Begründung exigée pour les écarts. */
export function PlanActualTable({
  pa,
  reportId,
  notes,
  editable,
  compact = false,
}: {
  pa: PlanActual;
  reportId?: string;
  notes?: Record<string, { text: string; by: string; at: string; fromVersion?: number }>;
  editable?: boolean;
  compact?: boolean;
}) {
  const { t, lang, fmtDate } = useWorkspace();
  const u = lang === "de" ? "Pers." : "ppl";
  return (
    <div className="print-break-avoid" data-testid="plan-actual">
      {!compact && (
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-2">{t.pa.title}</h2>
          <span className="text-xs text-muted">{t.pa.sub}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className={`w-full ${compact ? "min-w-[340px] text-xs" : "min-w-[560px] text-[13px]"} leading-5`}>
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="py-1.5 pr-3">{t.pa.colIndicator}</th>
              <th className="pr-3">{t.pa.colPlan}</th>
              <th className="pr-3">{t.pa.colActual}</th>
              <th className="pr-3">{t.pa.colDeviation}</th>
              {!compact && <th>{t.pa.colOpen}</th>}
            </tr>
          </thead>
          <tbody>
            {pa.rows.map((row) => (
              <tr key={row.key} className="border-b border-line align-top">
                <td className="py-2 pr-3 font-bold">{t.pa.row[row.key]}</td>
                <td className="py-2 pr-3">
                  {row.soll ? (
                    <span className="tabular">
                      <b>{row.soll.value}</b> {u} <span className="text-xs text-muted">· {row.soll.claimId} · {row.soll.evidenceId}</span>
                    </span>
                  ) : (
                    <span className="text-muted">{row.key === "participants" ? t.pa.notSelected : t.pa.noTarget}</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {row.ist ? (
                    <span className="tabular">
                      <b className="text-good-ink">{row.ist.value}</b> {row.key === "sessions" ? "" : u}{" "}
                      <span className="text-xs text-muted">
                        · {row.ist.claimId} · {row.ist.evidenceId}
                        {row.ist.derived ? ` · ${t.pa.derived}` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">{row.open.length ? t.pa.noEvidence : t.pa.notSelected}</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <DeviationCell row={row} lang={lang} />
                </td>
                {!compact && (
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.open.map((o) => (
                        <Pill key={o.claimId} cls={o.status === "UNKNOWN" ? "bg-surface-2 text-ink-2" : "bg-warning-soft text-warning-ink"}>
                          {o.claimId} · {o.value ?? "—"}
                        </Pill>
                      ))}
                      {row.excluded.map((o) => (
                        <Pill key={o.claimId} cls="bg-critical-soft text-critical-ink" title={o.equalsSoll ? t.pa.equalsPlan : undefined}>
                          <Ban size={11} /> {o.claimId} · {o.value ?? "—"} {o.equalsSoll ? t.pa.equalsPlan : ""}
                        </Pill>
                      ))}
                      {!row.open.length && !row.excluded.length && <span className="text-muted">—</span>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact &&
        pa.rows
          .filter((r) => r.needsJustification)
          .map((r) => <Justification key={r.key} row={r} reportId={reportId} note={notes?.[r.key]} editable={!!editable} fmtDate={fmtDate} threshold={pa.threshold} />)}
    </div>
  );
}

function Justification({
  row,
  reportId,
  note,
  editable,
  fmtDate,
  threshold,
}: {
  row: PlanActualRow;
  reportId?: string;
  note?: { text: string; by: string; at: string; fromVersion?: number };
  editable: boolean;
  fmtDate: (s: string) => string;
  threshold: number;
}) {
  const { t, identity, me, refresh, lang } = useWorkspace();
  const [text, setText] = useState(note?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => setText(note?.text ?? ""), [note?.text]);

  async function save(value: string) {
    if (!reportId) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/reports/${reportId}/deviation`, "PUT", { rowKey: row.key, text: value, by: me, role: identity.role });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const canEdit = editable && identity.role === "officer";
  return (
    <div className={`mt-3 rounded-[3px] border p-3 text-sm ${note?.text ? "border-line bg-page" : "border-critical/50 bg-critical-soft"}`} data-testid={`justify-${row.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <b>
          {t.pa.justification} · {t.pa.row[row.key]}
        </b>
        {!note?.text && <Pill cls="bg-critical text-white">{t.pa.missing}</Pill>}
      </div>
      <div className="mt-0.5 text-xs text-ink-2">{t.pa.justificationHint(threshold)}</div>
      {canEdit ? (
        <div className="no-print mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t.pa.justificationPh}
            className="w-full rounded-[3px] border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" className="px-2.5 py-1 text-xs" disabled={busy} onClick={() => { setText(t.pa.askPartner); save(t.pa.askPartner); }}>
              {t.pa.askPartner}
            </Button>
            <Button className="px-2.5 py-1 text-xs" disabled={busy || text.trim() === (note?.text ?? "")} onClick={() => save(text)}>
              {saved ? t.pa.saved : t.pa.save}
            </Button>
            {error && <span className="text-xs text-critical-ink">{error}</span>}
          </div>
        </div>
      ) : (
        <>
          {note?.text && <p className="mt-2 italic">{lang === "de" ? `„${note.text}“` : `“${note.text}”`}</p>}
          {editable || !note?.text ? <div className="no-print mt-1 text-xs text-muted">{t.pa.notEditable}</div> : null}
        </>
      )}
      {note?.text && (
        <div className="mt-1 text-xs text-muted">
          {t.pa.by(note.by, fmtDate(note.at))}
          {note.fromVersion ? ` · ${t.pa.carried(note.fromVersion)}` : ""}
        </div>
      )}
    </div>
  );
}

const STATE_STYLE: Record<ChainLevel["state"], { cls: string; Icon: typeof CheckCircle2 }> = {
  evidenced: { cls: "bg-good-soft text-good-ink", Icon: CheckCircle2 },
  open: { cls: "bg-warning-soft text-warning-ink", Icon: CircleHelp },
  none: { cls: "bg-surface-2 text-ink-2", Icon: CircleDashed },
  not_claimable: { cls: "bg-surface-2 text-muted", Icon: Ban },
};

/** Wirkungskette : ce que les pièces choisies permettent d'affirmer, niveau par niveau. */
export function ResultsChain({ pa }: { pa: PlanActual }) {
  const { t } = useWorkspace();
  return (
    <div className="print-break-avoid" data-testid="results-chain">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-2">{t.pa.chainTitle}</h2>
      <ol className="flex flex-col gap-1 sm:flex-row sm:gap-0">
        {pa.chain.map((lvl, i) => {
          const s = STATE_STYLE[lvl.state];
          return (
            <li key={lvl.key} className={`chain-step flex-1 px-4 py-2 ${s.cls} ${i > 0 ? "sm:-ml-2" : ""}`}>
              <div className="flex items-center gap-1.5 text-[12px] font-bold">
                <s.Icon size={13} /> {t.pa.chain[lvl.key]}
              </div>
              <div className="text-[11px]">
                {t.pa.state[lvl.state]}
                {lvl.claimIds.length > 0 && <span className="tabular"> · {lvl.claimIds.join(", ")}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
        <ArrowRight size={12} /> {t.pa.impactNote}
      </div>
    </div>
  );
}
