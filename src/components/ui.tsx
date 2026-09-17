"use client";

import { CheckCircle2, CircleHelp, CircleSlash, Crosshair, OctagonAlert, TriangleAlert } from "lucide-react";
import { EVIDENCE_TIER } from "@/lib/engine/lexicon";
import { EVIDENCE_TYPE_L, STATUS_HINT_L, STATUS_L } from "@/lib/i18n/terms";
import type { ClaimStatus, Evidence, EvidenceType } from "@/lib/types";
import { useWorkspace } from "./workspace";

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {sub && <div className="mt-1.5 max-w-3xl text-[15px] leading-6 text-ink-2">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Pill({ cls, children, title }: { cls: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

export const STATUS_STYLE: Record<ClaimStatus, { cls: string; bar: string; Icon: typeof CheckCircle2 }> = {
  VERIFIED: { cls: "bg-good-soft text-good-ink", bar: "var(--good)", Icon: CheckCircle2 },
  TARGET: { cls: "bg-target-soft text-target-ink", bar: "var(--target)", Icon: Crosshair },
  UNCERTAIN: { cls: "bg-warning-soft text-warning-ink", bar: "var(--warning)", Icon: TriangleAlert },
  UNKNOWN: { cls: "bg-surface-2 text-ink-2", bar: "var(--muted)", Icon: CircleHelp },
  MISLEADING: { cls: "bg-critical-soft text-critical-ink", bar: "var(--critical)", Icon: OctagonAlert },
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const { lang } = useWorkspace();
  const s = STATUS_STYLE[status];
  return (
    <Pill cls={s.cls} title={STATUS_HINT_L[lang][status]}>
      <s.Icon size={12} /> {STATUS_L[lang][status]}
    </Pill>
  );
}

export function EvidenceTypeBadge({ type }: { type: EvidenceType }) {
  const { lang, t } = useWorkspace();
  const tier = EVIDENCE_TIER[type];
  const cls =
    tier === "record" ? "bg-good-soft text-good-ink" : tier === "plan" ? "bg-target-soft text-target-ink" : tier === "rule" ? "bg-surface-2 text-ink-2" : "bg-warning-soft text-warning-ink";
  return (
    <Pill cls={cls} title={tier === "hearsay" ? t.badge.hearsay : undefined}>
      {EVIDENCE_TYPE_L[lang][type]}
    </Pill>
  );
}

export function OriginBadge({ origin }: { origin: Evidence["origin"] }) {
  const { t } = useWorkspace();
  if (origin === "simulated")
    return (
      <Pill cls="border border-dashed border-warning text-warning-ink" title={t.badge.simulatedTitle}>
        <CircleSlash size={11} /> {t.common.simulated}
      </Pill>
    );
  if (origin === "supplied") return <Pill cls="bg-surface-2 text-ink-2">{t.badge.supplied}</Pill>;
  return (
    <Pill cls="bg-surface-2 text-ink-2" title={t.badge.userTitle}>
      {origin === "uploaded" ? t.badge.uploaded : t.badge.pasted}
    </Pill>
  );
}

export function SimulatedTag({ label }: { label?: string }) {
  const { t } = useWorkspace();
  return <Pill cls="border border-dashed border-warning text-warning-ink">{label ?? t.common.simulated}</Pill>;
}

export function IncoherenceMeter({ value, status }: { value: number; status: ClaimStatus }) {
  const { t } = useWorkspace();
  return (
    <div className="flex items-center gap-2" title={t.badge.incoherenceTitle}>
      <span className="text-[11px] text-muted">{t.badge.incoherence}</span>
      <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${value}%`, background: STATUS_STYLE[status].bar }} />
      </span>
      <span className="tabular text-[11px] text-ink-2">{value}</span>
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-ink",
    ghost: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
    danger: "border border-line-strong bg-surface text-critical-ink hover:bg-critical-soft",
    soft: "bg-accent-soft text-accent-ink hover:brightness-95",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[3px] px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

export function Loading() {
  const { t } = useWorkspace();
  return <div className="text-sm text-muted">{t.common.loading}</div>;
}
