"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, GitCompare, Plus, X } from "lucide-react";
import { fmt } from "@/lib/engine/decide";
import { INDICATOR_L, claimView } from "@/lib/i18n/terms";
import { TAXONOMY } from "@/lib/engine/lexicon";
import type { Claim } from "@/lib/types";
import { EvidenceTypeBadge, IncoherenceMeter, STATUS_STYLE, StatusBadge } from "./ui";
import { useWorkspace } from "./workspace";

function Highlight({ text, surface }: { text: string; surface: string }) {
  if (!surface) return <>{text}</>;
  const i = text.toLowerCase().indexOf(surface.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="cite-hl font-bold">{text.slice(i, i + surface.length)}</mark>
      {text.slice(i + surface.length)}
    </>
  );
}

export function ClaimCard({
  claim,
  inBag,
  onToggle,
  onFocusClaim,
  focused,
  flag,
}: {
  claim: Claim;
  inBag: boolean;
  onToggle: () => void;
  onFocusClaim: (id: string) => void;
  focused: boolean;
  flag?: { text: string; tone: "new" | "changed" };
}) {
  const { t, lang } = useWorkspace();
  const [open, setOpen] = useState(false);
  const st = STATUS_STYLE[claim.status];
  const v = claimView(claim, lang);
  const failed = v.checks.filter((c) => !c.pass);

  return (
    <article
      id={`claim-${claim.id}`}
      className={`card flex flex-col overflow-hidden transition-shadow ${focused ? "ring-2 ring-accent" : ""}`}
      style={{ borderTop: `4px solid ${st.bar}` }}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink-2">{claim.id}</span>
          <StatusBadge status={claim.status} />
          {flag && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${flag.tone === "new" ? "bg-target" : "bg-critical"}`}>
              {flag.text}
            </span>
          )}
          <span className="ml-auto">
            <IncoherenceMeter value={claim.incoherence} status={claim.status} />
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-3xl font-bold tracking-tight">{fmt(claim.value)}</span>
            {claim.value !== null && <span className="text-sm text-ink-2">{v.unit}</span>}
          </div>
          <div className="text-[15px] font-bold leading-snug">{v.label}</div>
          {claim.headline && (
            <div className="text-xs text-muted">
              {t.card.interpretation} {INDICATOR_L[lang][claim.indicator]}
            </div>
          )}
          <div className="text-xs text-muted">{claim.period}</div>
        </div>

        <p className="text-sm leading-6">{v.summary}</p>

        <blockquote className="rounded-[3px] border-l-[3px] border-line-strong bg-page px-3 py-2 text-[13px] leading-5 text-ink-2">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 not-italic">
            <span className="text-[11px] font-bold text-ink">{claim.evidenceId}</span>
            <EvidenceTypeBadge type={claim.evidenceType} />
          </div>
          <span className="italic">
            {claim.derivation ? v.quote : <>“<Highlight text={claim.quote} surface={claim.surface} />”</>}
          </span>
        </blockquote>

        {v.confusions.length > 0 && (
          <div className="space-y-1">
            {v.confusions.map((c, i) => (
              <button
                key={i}
                onClick={() => onFocusClaim(c.claimId)}
                className="flex w-full items-start gap-1.5 rounded-[3px] px-2 py-1 text-left text-xs text-ink-2 hover:bg-surface-2"
              >
                <GitCompare size={13} className="mt-0.5 shrink-0 text-target-ink" />
                <span>
                  <b className="text-target-ink">{c.claimId}</b> · {c.note}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-[3px] border border-line p-2">
            <div className="mb-0.5 font-bold text-ink">{t.card.risk}</div>
            <div className="text-ink-2">{v.risk}</div>
          </div>
          <div className="rounded-[3px] border border-line p-2">
            <div className="mb-0.5 font-bold text-ink">{t.card.advice}</div>
            <div className="text-ink-2">{v.advice}</div>
          </div>
        </div>

        <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="inline-flex items-center gap-1 self-start text-xs text-ink-2 hover:text-ink">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t.card.why} {failed.length > 0 ? t.card.failed(failed.length) : t.card.allPassed}
        </button>
        {open && (
          <div className="space-y-2 rounded-[3px] bg-page p-3 text-xs">
            {v.reasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-ink">
                {v.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <ul className="space-y-0.5">
              {v.checks.map((c, i) => (
                <li key={i} className="flex gap-1.5">
                  {c.pass ? <Check size={13} className="mt-0.5 shrink-0 text-good-ink" /> : <X size={13} className="mt-0.5 shrink-0 text-critical-ink" />}
                  <span>
                    {c.name}
                    {c.detail && <span className="text-muted"> — {c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {claim.question && (
              <div className="border-t border-line pt-2 text-ink-2">
                <div>
                  <b>{t.card.question}</b> <span lang="en">{claim.question}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {claim.readings.map((r, i) => (
                    <span key={i} className="rounded-[3px] bg-surface-2 px-1.5 py-0.5" title={TAXONOMY[r.choice]}>
                      {t.card.reading(i + 1)}: {r.choice} · {r.modality}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {claim.derivation && (
              <div className="text-ink-2">
                <b>{t.card.computed}</b> {claim.derivation}
              </div>
            )}
            <div className="text-muted">{v.textSource === "model" ? t.card.textModel : t.card.textTemplate}</div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <button
          onClick={onToggle}
          aria-pressed={inBag}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-[3px] px-3 py-2 text-sm font-bold transition ${
            inBag ? "bg-accent-soft text-accent-ink hover:brightness-95" : "bg-accent text-on-accent hover:bg-accent-ink"
          }`}
        >
          {inBag ? (
            <>
              <Check size={15} /> {t.card.inBag}
            </>
          ) : (
            <>
              <Plus size={15} /> {t.card.add}
            </>
          )}
        </button>
      </div>
    </article>
  );
}
