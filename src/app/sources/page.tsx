"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, ClipboardPaste, Lock, Play, ShieldAlert, Trash2, Upload } from "lucide-react";
import { EVIDENCE_TIER } from "@/lib/engine/lexicon";
import { findMentions } from "@/lib/engine/mentions";
import { EVIDENCE_TYPE_L } from "@/lib/i18n/terms";
import type { EvidenceType } from "@/lib/types";
import { applyStepEvent, Pipeline, type Step } from "@/components/Pipeline";
import { Button, EvidenceTypeBadge, Loading, OriginBadge, PageHeader, Pill } from "@/components/ui";
import { api, errText, postStream, useWorkspace } from "@/components/workspace";

const TYPES = Object.keys(EVIDENCE_TYPE_L.en) as EvidenceType[];

function Marked({ text, ev, title }: { text: string; ev: Parameters<typeof findMentions>[0]; title: string }) {
  const ms = findMentions(ev);
  if (!ms.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of ms) {
    parts.push(text.slice(last, m.pos));
    parts.push(
      <mark key={m.mid} className="cite-hl font-bold" title={title}>
        {text.slice(m.pos, m.pos + m.surface.length)}
      </mark>,
    );
    last = m.pos + m.surface.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

const guessLang = (text: string) => (/[äöüß]|\b(der|die|und|nicht)\b/i.test(text) ? "de" : /\b(les|une|des|jours)\b|[éèà]/i.test(text) ? "fr" : "en");

export default function SourcesPage() {
  const { ws, refresh, t, lang } = useWorkspace();
  const [drag, setDrag] = useState(false);
  const [paste, setPaste] = useState({ name: "", text: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [done, setDone] = useState<null | { ok: boolean; msg: string }>(null);
  const [synthetic, setSynthetic] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ws) return <Loading />;
  const last = ws.analyses[0];
  const stale = !last || ws.evidence.some((e) => !last.evidenceIds.includes(e.id));
  const TL = EVIDENCE_TYPE_L[lang];

  async function upload(files: FileList | File[]) {
    setError("");
    if (!synthetic) {
      setError(t.sources.tickFirst);
      return;
    }
    const fd = new FormData();
    fd.append("synthetic", "yes");
    for (const f of Array.from(files)) fd.append("files", f);
    setBusy("upload");
    try {
      await api("/api/evidence", "POST", fd);
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  }

  async function analyze() {
    setBusy("analyze");
    setSteps([]);
    setDone(null);
    setError("");
    try {
      await postStream("/api/analyze", (e) => {
        if (e.type === "step_start" || e.type === "step_end") setSteps((s) => applyStepEvent(s, e as never));
        if (e.type === "analysis") {
          const a = e.analysis as { status: string; claimIds: string[]; error?: string };
          setDone(a.status === "done" ? { ok: true, msg: t.sources.ready(a.claimIds.length) } : { ok: false, msg: a.error ?? t.sources.failed });
        }
        if (e.type === "error") setDone({ ok: false, msg: String(e.message) });
      });
    } catch (err) {
      setDone({ ok: false, msg: errText(err) });
    }
    await refresh();
    setBusy("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t.sources.title}
        sub={t.sources.sub}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {last && !stale && (
              <Link href="/claims">
                <Button variant="ghost">
                  {t.sources.openClaims} <ArrowRight size={15} />
                </Button>
              </Link>
            )}
            <Button onClick={analyze} disabled={!!busy || !ws.evidence.length}>
              <Play size={15} /> {last ? t.sources.reanalyse : t.sources.analyse}
            </Button>
          </div>
        }
      />

      {(busy === "analyze" || done) && (
        <div className="card mb-4 p-4">
          <div className="mb-2 text-[15px] font-bold">{t.sources.pipeline}</div>
          <Pipeline steps={steps} running={busy === "analyze"} />
          {done && (
            <div className={`mt-3 flex items-center gap-3 text-sm ${done.ok ? "text-good-ink" : "text-critical-ink"}`}>
              {done.msg}
              {done.ok && (
                <Link href="/claims" className="font-bold text-accent-ink underline">
                  {t.sources.review}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {ws.evidence.map((ev) => {
            const needsConfirm = !ev.typeConfirmed;
            return (
              <div key={ev.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold">{ev.id}</span>
                  <EvidenceTypeBadge type={ev.type} />
                  <OriginBadge origin={ev.origin} />
                  {ev.fileName && ev.origin !== "supplied" && <span className="text-xs text-muted">{ev.fileName}</span>}
                  {last && !last.evidenceIds.includes(ev.id) && <Pill cls="bg-target-soft text-target-ink">{t.sources.notAnalysed}</Pill>}
                  <div className="ml-auto flex items-center gap-2">
                    <select
                      aria-label={t.sources.typeFor(ev.id)}
                      value={ev.type}
                      disabled={ev.origin === "supplied"}
                      onChange={async (e) => {
                        await api(`/api/evidence/${ev.id}`, "PATCH", { type: e.target.value });
                        await refresh();
                      }}
                      className={`rounded-[3px] border bg-surface px-2 py-1 text-xs ${needsConfirm ? "border-warning" : "border-line"}`}
                    >
                      {TYPES.map((x) => (
                        <option key={x} value={x}>
                          {TL[x]}
                        </option>
                      ))}
                    </select>
                    {needsConfirm && (
                      <Button
                        variant="soft"
                        className="px-2 py-1 text-xs"
                        onClick={async () => {
                          await api(`/api/evidence/${ev.id}`, "PATCH", { type: ev.type });
                          await refresh();
                        }}
                      >
                        {t.sources.confirmType}
                      </Button>
                    )}
                    {ev.origin !== "supplied" && (
                      <button
                        className="rounded p-1 text-muted hover:bg-surface-2 hover:text-critical-ink"
                        aria-label={t.common.remove(ev.id)}
                        onClick={async () => {
                          await api(`/api/evidence/${ev.id}`, "DELETE");
                          await refresh();
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
                {needsConfirm && (
                  <div className="mt-2 text-xs text-warning-ink">
                    {t.sources.suggested} <b>{TL[ev.suggestedType ?? ev.type]}</b>. {t.sources.suggestedTail}
                  </div>
                )}
                <p className="mt-2 text-[16px] leading-7" lang={guessLang(ev.text)}>
                  <Marked text={ev.text} ev={ev} title={t.sources.numberFound} />
                </p>
                {EVIDENCE_TIER[ev.type] === "hearsay" && <div className="mt-1 text-xs text-muted">{t.sources.hearsay}</div>}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <label className="card flex cursor-pointer items-start gap-2.5 border-warning/60 bg-warning-soft p-3 text-xs leading-5 text-warning-ink" data-testid="synthetic-confirm">
            <input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-current" />
            <span>
              <span className="mb-0.5 flex items-center gap-1 font-bold">
                <ShieldAlert size={13} /> {t.sources.syntheticTitle}
              </span>
              {t.sources.syntheticBody(ws.client ?? "Schmitz-Stiftungen")}
            </span>
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              upload(e.dataTransfer.files);
            }}
            className={`card flex flex-col items-center gap-2 border-2 border-dashed p-6 text-center ${drag ? "border-accent bg-accent-soft" : "border-line-strong"}`}
          >
            <Upload size={22} className="text-accent" />
            <div className="text-[15px] font-bold">{t.sources.drop}</div>
            <div className="text-xs text-muted">{t.sources.dropHint}</div>
            <input ref={fileRef} type="file" multiple accept=".json,.txt,.md,.csv" className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
            <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy === "upload" || !synthetic}>
              {busy === "upload" ? t.sources.uploading : t.sources.choose}
            </Button>
          </div>

          <form
            className="card space-y-2 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy("paste");
              try {
                await api("/api/evidence", "POST", { ...paste, synthetic: true });
                setPaste({ name: "", text: "" });
                await refresh();
              } catch (err) {
                setError(errText(err));
              } finally {
                setBusy("");
              }
            }}
          >
            <div className="flex items-center gap-2 text-[15px] font-bold">
              <ClipboardPaste size={15} /> {t.sources.paste}
            </div>
            <input
              aria-label={t.sources.pasteName}
              value={paste.name}
              onChange={(e) => setPaste({ ...paste, name: e.target.value })}
              placeholder={t.sources.pasteName}
              className="w-full rounded-[3px] border border-line bg-surface px-3 py-2 text-sm"
            />
            <textarea
              aria-label={t.sources.pasteText}
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              rows={4}
              placeholder={t.sources.pasteText}
              className="w-full rounded-[3px] border border-line bg-surface px-3 py-2 text-sm"
            />
            <Button type="submit" className="w-full" disabled={busy === "paste" || !synthetic || paste.text.trim().length < 3 || !paste.name.trim()}>
              {busy === "paste" ? t.sources.adding : t.sources.addNote}
            </Button>
          </form>
          {error && <div className="rounded-[3px] bg-critical-soft px-3 py-2 text-sm text-critical-ink">{error}</div>}

          <div className="card p-4">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-bold">
              <Lock size={14} /> {t.sources.rules}
            </div>
            <ul className="space-y-2 text-xs">
              {ws.rules.map((r) => (
                <li key={r.id} className={`rounded-[3px] border border-line p-2 ${r.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-2">
                    <b>{r.id}</b>
                    <span className="text-muted">{r.source === "reviewer-feedback" ? t.sources.fromReviewer : t.sources.supplied}</span>
                    <label className="ml-auto inline-flex items-center gap-1 text-muted">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={async (e) => {
                          await api(`/api/rules/${r.id}`, "PATCH", { active: e.target.checked });
                          await refresh();
                        }}
                      />
                      {t.sources.active}
                    </label>
                  </div>
                  <div className="mt-1 text-ink" lang={r.source === "reviewer-feedback" ? undefined : "en"}>
                    {r.text}
                  </div>
                  {lang === "de" && r.textDe && (
                    <div className="mt-0.5 text-ink-2">
                      <span className="text-muted">{t.sources.translation}:</span> {r.textDe}
                    </div>
                  )}
                  <div className="mt-1 text-muted">
                    {t.sources.enforcedBy} {lang === "de" ? r.enforcedByDe ?? r.enforcedBy : r.enforcedBy}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
