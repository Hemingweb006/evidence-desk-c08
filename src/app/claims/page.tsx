"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FilePlus2, FolderOpen, Send } from "lucide-react";
import { STATUS_HINT_L, STATUS_L } from "@/lib/i18n/terms";
import type { ClaimStatus } from "@/lib/types";
import { ClaimCard } from "@/components/ClaimCard";
import { Button, Loading, PageHeader, STATUS_STYLE } from "@/components/ui";
import { api, useWorkspace } from "@/components/workspace";

const STATUSES: ClaimStatus[] = ["MISLEADING", "UNCERTAIN", "UNKNOWN", "TARGET", "VERIFIED"];

export default function ClaimsPage() {
  const { ws, toggleBag, setBagOpen, refresh, t, lang, identity } = useWorkspace();
  const router = useRouter();
  const [filter, setFilter] = useState<ClaimStatus | "ALL">("ALL");
  const [sort, setSort] = useState<"risk" | "id">("risk");
  const [focus, setFocus] = useState<string | null>(null);

  const claims = useMemo(() => {
    const list = (ws?.claims ?? []).filter((c) => filter === "ALL" || c.status === filter);
    return [...list].sort((a, b) => (sort === "risk" ? b.incoherence - a.incoherence : Number(a.id.slice(1)) - Number(b.id.slice(1))));
  }, [ws, filter, sort]);

  if (!ws) return <Loading />;

  if (!ws.claims.length)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t.claims.title} />
        <div className="card p-8 text-center text-sm text-ink-2">
          {t.claims.empty}{" "}
          <Link href="/sources" className="font-bold text-accent-ink underline">
            {t.claims.emptyLink}
          </Link>
          {t.claims.emptyTail === "." ? "." : ` ${t.claims.emptyTail}`}
        </div>
      </div>
    );

  const focusOn = (id: string) => {
    setFilter("ALL");
    setFocus(id);
    setTimeout(() => document.getElementById(`claim-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setTimeout(() => setFocus(null), 2500);
  };
  const imp = ws.impacts?.[0];
  const flagOf = (id: string) => {
    if (!imp) return undefined;
    if (imp.newClaimIds.includes(id)) return { text: t.claims.flagNew(imp.newEvidenceIds.join(", ") || "—"), tone: "new" as const };
    const ch = imp.changes.find((c) => c.id === id);
    if (ch) return { text: t.claims.flagChanged(STATUS_L[lang][ch.before.status]), tone: "changed" as const };
    return undefined;
  };
  const removedSelected = imp ? imp.changes.filter((c) => c.kind === "removed" && (ws.bag.includes(c.id) || c.reportIds.length)) : [];
  const verifiedNotInBag = ws.claims.filter((c) => (c.status === "VERIFIED" || c.status === "TARGET") && !ws.bag.includes(c.id));

  return (
    <div className="mx-auto max-w-7xl pb-24">
      <PageHeader
        title={t.claims.title}
        sub={t.claims.sub}
        right={
          <Button
            variant="ghost"
            disabled={!verifiedNotInBag.length}
            onClick={async () => {
              await api("/api/bag", "POST", { action: "add_many", claimIds: verifiedNotInBag.map((c) => c.id) });
              await refresh();
            }}
          >
            {t.claims.addAll}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("ALL")}
          aria-pressed={filter === "ALL"}
          className={`rounded-full border px-3 py-1 text-xs ${filter === "ALL" ? "border-accent bg-accent-soft font-bold text-accent-ink" : "border-line text-ink-2"}`}
        >
          {t.claims.all} ({ws.claims.length})
        </button>
        {STATUSES.map((s) => {
          const n = ws.claims.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              disabled={!n}
              aria-pressed={filter === s}
              title={STATUS_HINT_L[lang][s]}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${filter === s ? "border-accent bg-accent-soft font-bold text-accent-ink" : "border-line text-ink-2"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[s].bar }} />
              {STATUS_L[lang][s]} ({n})
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-2">
          {t.claims.sort}
          <select value={sort} onChange={(e) => setSort(e.target.value as "risk" | "id")} className="rounded-[3px] border border-line bg-surface px-2 py-1">
            <option value="risk">{t.claims.sortRisk}</option>
            <option value="id">{t.claims.sortId}</option>
          </select>
        </label>
      </div>

      {removedSelected.length > 0 && (
        <div className="mb-4 rounded-[3px] border border-dashed border-critical/50 px-4 py-3 text-sm" data-testid="removed-claims">
          <b className="text-critical-ink">{t.claims.removed}</b>{" "}
          {removedSelected.map((c) => (
            <span key={c.id} className="mr-3 inline-block">
              <b>{c.id}</b>{" "}
              <span className="text-ink-2 line-through">
                {STATUS_L[lang][c.before.status]} · {lang === "de" ? c.before.labelDe ?? c.before.label : c.before.label} ({c.before.evidenceId})
              </span>
              {c.replacedBy.length > 0 && (
                <>
                  {" → "}
                  {c.replacedBy.map((r) => (
                    <button key={r} className="font-bold text-accent-ink underline" onClick={() => focusOn(r)}>
                      {r}
                    </button>
                  ))}
                </>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {claims.map((c) => (
          <ClaimCard
            key={c.id}
            claim={c}
            inBag={ws.bag.includes(c.id)}
            onToggle={() => toggleBag(c.id, ws.bag.includes(c.id))}
            onFocusClaim={focusOn}
            focused={focus === c.id}
            flag={flagOf(c.id)}
          />
        ))}
      </div>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 md:px-8">
          <button onClick={() => setBagOpen(true)} className="inline-flex items-center gap-2 text-sm font-bold">
            <FolderOpen size={17} className="text-accent" />
            {t.nav.bag}
            <span className="rounded-full bg-accent px-2 text-xs text-on-accent">{ws.bag.length}</span>
          </button>
          <div className="hidden gap-1 sm:flex">
            {ws.bag.slice(0, 12).map((id) => {
              const valid = ws.claims.some((c) => c.id === id);
              return (
                <button
                  key={id}
                  onClick={() => (valid ? focusOn(id) : setBagOpen(true))}
                  title={valid ? undefined : t.claims.noLonger}
                  className={`rounded-[3px] px-1.5 py-0.5 text-[11px] hover:bg-accent-soft ${valid ? "bg-surface-2 text-ink-2" : "bg-critical-soft text-critical-ink line-through"}`}
                >
                  {id}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/sources")}>
              <FilePlus2 size={15} /> {t.claims.addMore}
            </Button>
            <Button disabled={!ws.bag.length || identity.role !== "officer"} title={identity.role !== "officer" ? t.bag.switchOfficer : undefined} onClick={() => router.push("/report?generate=1")}>
              <Send size={15} /> {t.claims.push}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
