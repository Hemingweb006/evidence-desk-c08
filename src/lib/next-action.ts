import { rowsNeedingJustification } from "./engine/plan-actual";
import type { Impact, Report, Workspace } from "./types";

/** Dernière version d'un rapport (suit la chaîne supersededBy). */
export function latestVersion(ws: Workspace, r: Report): Report {
  let cur = r;
  const seen = new Set<string>();
  while (cur.supersededBy && !seen.has(cur.id)) {
    seen.add(cur.id);
    const next = ws.reports.find((x) => x.id === cur.supersededBy);
    if (!next) break;
    cur = next;
  }
  return cur;
}

export const reportName = (r: Report) => `v${r.version ?? 1}`;

export function unreadEvidence(ws: Workspace) {
  const last = ws.analyses.find((a) => a.status === "done");
  return last ? ws.evidence.filter((e) => !last.evidenceIds.includes(e.id)).map((e) => e.id) : [];
}

export const invalidBagIds = (ws: Workspace) => ws.bag.filter((id) => !ws.claims.some((c) => c.id === id));

/** Un impact reste ouvert tant qu'un rapport obsolète n'a pas de nouvelle version approuvée, ou que la mappe garde un claim invalide. */
export function openImpact(ws: Workspace): Impact | null {
  const imp = ws.impacts?.[0];
  if (!imp) return null;
  const selected = imp.changes.filter((c) => c.inBag || c.reportIds.length);
  if (!selected.length && !imp.outdatedReportIds.length) return null;
  const reportsOpen = imp.outdatedReportIds.some((id) => {
    const r = ws.reports.find((x) => x.id === id);
    return r && latestVersion(ws, r).status !== "approved";
  });
  const bagOpen = selected.some((c) => c.inBag && ws.bag.includes(c.id) && !ws.claims.some((x) => x.id === c.id));
  return reportsOpen || bagOpen ? imp : null;
}

export type NextKind = "analyse" | "reanalyse" | "outdated" | "justify" | "review" | "cleanBag" | "redraftRule" | "approved" | "push" | "choose";

export interface NextAction {
  kind: NextKind;
  tone: "accent" | "warning" | "critical" | "good";
  href?: string;
  redraftId?: string;
  v?: string;
  n?: number;
  ids?: string;
  name?: string;
  wasApproved?: boolean;
  rows?: string[];
}

export function nextAction(ws: Workspace): NextAction {
  const done = ws.analyses.find((a) => a.status === "done");
  if (!done) return { kind: "analyse", tone: "accent", n: ws.evidence.length, href: "/sources" };
  const unread = unreadEvidence(ws);
  if (unread.length) return { kind: "reanalyse", tone: "warning", ids: unread.join(", "), href: "/sources" };
  const outdated = ws.reports.find((r) => r.status === "outdated" && !r.supersededBy);
  if (outdated)
    return {
      kind: "outdated", tone: "critical", v: reportName(outdated),
      ids: outdated.outdated?.changedClaimIds.join(", ") ?? "",
      wasApproved: outdated.outdated?.previousStatus === "approved",
      href: `/report/${outdated.id}`, redraftId: outdated.id,
    };
  const draft = ws.reports.find((r) => r.status === "draft" && !r.supersededBy);
  if (draft) {
    const missing = rowsNeedingJustification(draft.planActual).filter((row) => !draft.deviationNotes?.[row.key]?.text.trim());
    if (missing.length) return { kind: "justify", tone: "warning", v: reportName(draft), rows: missing.map((m) => m.key), href: `/report/${draft.id}` };
    return { kind: "review", tone: "warning", v: reportName(draft), href: `/report/${draft.id}` };
  }
  const bad = invalidBagIds(ws);
  if (bad.length) return { kind: "cleanBag", tone: "warning", ids: bad.join(", "), href: "#bag" };
  const latest = ws.reports[0];
  if (latest?.status === "changes_requested" && !latest.supersededBy)
    return { kind: "redraftRule", tone: "warning", name: latest.review?.reviewer, href: `/report/${latest.id}`, redraftId: latest.id };
  if (latest?.status === "approved") return { kind: "approved", tone: "good", v: reportName(latest), name: latest.review?.reviewer, href: `/report/${latest.id}` };
  if (ws.bag.length) return { kind: "push", tone: "accent", n: ws.bag.length, href: "#bag" };
  return { kind: "choose", tone: "accent", n: ws.claims.length, href: "/claims" };
}
