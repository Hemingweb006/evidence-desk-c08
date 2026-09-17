"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, FolderOpen, Send, Trash2, X } from "lucide-react";
import { fmt } from "@/lib/engine/decide";
import { computePlanActual } from "@/lib/engine/plan-actual";
import { STATUS_L, claimView } from "@/lib/i18n/terms";
import { PlanActualTable } from "./PlanActual";
import { Button, StatusBadge } from "./ui";
import { api, useWorkspace } from "./workspace";

/** « Berichtsmappe » : les claims choisis, avant le rapport. */
export function BagPanel() {
  const { ws, bagOpen, setBagOpen, toggleBag, refresh, t, lang, identity, me } = useWorkspace();
  const router = useRouter();
  if (!bagOpen || !ws) return null;
  const items = ws.bag.map((id) => ({ id, claim: ws.claims.find((c) => c.id === id), meta: ws.bagMeta[id] }));
  const valid = items.filter((i) => i.claim).map((i) => i.claim!);
  const pa = computePlanActual(valid);
  const isOfficer = identity.role === "officer";

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end bg-black/25" onClick={() => setBagOpen(false)}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={t.bag.title}
        role="dialog"
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <FolderOpen size={18} className="text-accent" />
          <div className="text-[17px] font-bold">{t.bag.title}</div>
          <span className="rounded-full bg-surface-2 px-2 text-xs text-ink-2">{valid.length}</span>
          <button className="ml-auto rounded p-1 hover:bg-surface-2" onClick={() => setBagOpen(false)} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {items.length === 0 && (
            <div className="rounded-[3px] border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              {t.bag.empty1}{" "}
              <Link href="/claims" className="text-accent-ink underline" onClick={() => setBagOpen(false)}>
                {t.bag.claimsLink}
              </Link>{" "}
              {t.bag.empty2} <b>{t.bag.addLabel}</b> {t.bag.empty3}
            </div>
          )}
          {items.map(({ id, claim, meta }) => {
            const v = claim ? claimView(claim, lang) : null;
            return (
              <div key={id} className="rounded-[3px] border border-line p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink-2">{id}</span>
                  {claim ? <StatusBadge status={claim.status} /> : <span className="text-xs font-bold text-critical-ink">{t.bag.invalid}</span>}
                  <button className="ml-auto rounded p-1 text-muted hover:bg-surface-2 hover:text-critical-ink" onClick={() => toggleBag(id, true)} aria-label={t.common.remove(id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {claim && v && (
                  <>
                    <div className="mt-1 text-sm">
                      <b className="tabular">{fmt(claim.value)}</b> {claim.value !== null && v.unit} · {v.label}
                    </div>
                    <div className="text-xs text-muted">
                      {claim.evidenceId} · {claim.period}
                    </div>
                    {meta && meta.statusAtAdd !== claim.status && (
                      <div className="mt-1 text-xs text-warning-ink">{t.bag.statusChanged(STATUS_L[lang][meta.statusAtAdd], STATUS_L[lang][claim.status])}</div>
                    )}
                  </>
                )}
                {!claim &&
                  (() => {
                    const ch = ws.impacts?.flatMap((i) => i.changes).find((c) => c.id === id);
                    const repl = (ch?.replacedBy ?? []).filter((r) => ws.claims.some((c) => c.id === r) && !ws.bag.includes(r));
                    return (
                      <div className="mt-1 text-xs text-muted">
                        {ch ? (
                          <>
                            {t.bag.was} <s>{lang === "de" ? ch.before.labelDe ?? ch.before.label : ch.before.label}</s> ({ch.before.evidenceId}).{" "}
                          </>
                        ) : null}
                        {t.bag.replaced}
                        {repl.length > 0 && (
                          <button
                            className="mt-1 block font-bold text-accent-ink underline"
                            onClick={async () => {
                              await api("/api/bag", "POST", { action: "add_many", claimIds: repl });
                              await api("/api/bag", "POST", { action: "remove", claimId: id });
                              await refresh();
                            }}
                          >
                            {t.bag.replaceWith(repl.join(", "))}
                          </button>
                        )}
                      </div>
                    );
                  })()}
              </div>
            );
          })}

          {valid.length > 0 && (
            <div className="mt-4 rounded-[3px] border border-line bg-page p-3">
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-2">{t.bag.preview}</div>
              <PlanActualTable pa={pa} compact />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4">
          <div className="text-xs text-muted">{isOfficer ? t.bag.preparedBy(me) : t.bag.switchOfficer}</div>
          <Button
            className="w-full"
            disabled={!valid.length || !isOfficer || me.length < 2}
            onClick={() => {
              setBagOpen(false);
              router.push("/report?generate=1");
            }}
          >
            <Send size={15} /> {t.bag.push}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setBagOpen(false);
                router.push("/sources");
              }}
            >
              <FilePlus2 size={15} /> {t.bag.addMore}
            </Button>
            <Button
              variant="danger"
              disabled={!items.length}
              onClick={async () => {
                await api("/api/bag", "POST", { action: "clear" });
                await refresh();
              }}
            >
              {t.bag.clear}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
