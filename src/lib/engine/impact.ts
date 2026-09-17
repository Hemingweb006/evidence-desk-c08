import type { LText } from "../i18n/core";
import type { Claim, ClaimChange, ClaimSnapshotLite, Impact, Indicator, Report, Workspace } from "../types";
import { INDICATOR_L } from "../i18n/terms";
import { claimLabel } from "./decide";

/**
 * Impact d'une nouvelle pièce — 100 % code, aucun modèle.
 * Un claim est « changé » si son statut, sa valeur, son sens ou sa pièce changent ;
 * « retiré » s'il n'existe plus après la ré-analyse.
 */

const fingerprint = (c: Claim) => `${c.status}|${c.value}|${c.indicator}|${c.headline ?? ""}|${c.evidenceId}`;
const lite = (c: Claim): ClaimSnapshotLite => ({
  status: c.status, value: c.value, label: claimLabel(c), labelDe: c.de?.headline ?? INDICATOR_L.de[c.indicator], evidenceId: c.evidenceId,
});

// Indicateurs qui répondent à la même question du bailleur
const FAMILY: Partial<Record<Indicator, string>> = {
  completed: "completion", passed: "completion",
  attended: "attendance", attended_day: "attendance", attended_overlap: "attendance", enrolled: "attendance",
  planned: "plan",
};
const family = (i: Indicator) => FAMILY[i] ?? i;

/** Rapports encore « vivants » (qui peuvent devenir obsolètes). */
export const LIVE_REPORT: Report["status"][] = ["draft", "approved", "changes_requested"];

/** Claims d'un instantané qui ne correspondent plus aux claims actuels. */
export function staleClaimIds(snapshot: Claim[], current: Claim[]): string[] {
  const now = new Map(current.map((c) => [c.id, c]));
  return snapshot.filter((c) => {
    const n = now.get(c.id);
    return !n || fingerprint(n) !== fingerprint(c);
  }).map((c) => c.id);
}

export function computeImpact(args: {
  before: Claim[];
  after: Claim[];
  ws: Workspace;
  trigger: LText;
  simulated: boolean;
  analysisId: string;
  newEvidenceIds: string[];
  now: string;
}): Impact | null {
  const { before, after, ws, trigger, simulated, analysisId, newEvidenceIds, now } = args;
  if (!before.length) return null; // première analyse : rien à comparer
  const beforeIds = new Set(before.map((c) => c.id));
  const afterMap = new Map(after.map((c) => [c.id, c]));
  const newClaims = after.filter((c) => !beforeIds.has(c.id));

  const liveReports = ws.reports.filter((r) => LIVE_REPORT.includes(r.status));
  const selectedIn = (id: string) => liveReports.filter((r) => r.claimIds.includes(id)).map((r) => r.id);

  const changes: ClaimChange[] = [];
  for (const b of before) {
    const a = afterMap.get(b.id);
    if (a && fingerprint(a) === fingerprint(b)) continue;
    const replacedBy = a ? [] : newClaims.filter((n) => family(n.indicator) === family(b.indicator)).map((n) => n.id);
    changes.push({
      id: b.id,
      kind: a ? "changed" : "removed",
      before: lite(b),
      after: a ? lite(a) : undefined,
      replacedBy,
      inBag: ws.bag.includes(b.id),
      reportIds: selectedIn(b.id),
    });
  }

  // Rapports : comparaison de leur instantané avec les claims actuels
  const outdatedReportIds = liveReports.filter((r) => staleClaimIds(r.claimsSnapshot, after).length > 0).map((r) => r.id);

  if (!changes.length && !newClaims.length) return null;
  return {
    id: `imp_${Date.now().toString(36)}`,
    at: now,
    trigger: trigger.en,
    triggerDe: trigger.de,
    simulated,
    analysisId,
    newEvidenceIds,
    newClaimIds: newClaims.map((c) => c.id),
    changes,
    outdatedReportIds,
  };
}

/** Marque les rapports obsolètes : leur approbation est retirée jusqu'à une nouvelle revue. */
export function markOutdated(ws: Workspace, impact: Impact) {
  for (const r of ws.reports) {
    if (!impact.outdatedReportIds.includes(r.id)) continue;
    r.outdated = {
      at: impact.at,
      previousStatus: r.status,
      changedClaimIds: staleClaimIds(r.claimsSnapshot, ws.claims),
      impactId: impact.id,
      trigger: impact.trigger,
      triggerDe: impact.triggerDe,
    };
    r.status = "outdated";
    (r.history ??= []).push({
      at: impact.at, who: "Evidence Desk", role: "system", action: "outdated",
      note: `${impact.trigger}: ${r.outdated.changedClaimIds.join(", ")}`,
      noteDe: `${impact.triggerDe ?? impact.trigger}: ${r.outdated.changedClaimIds.join(", ")}`,
    });
  }
}

/** Claims à mettre dans le bag pour refaire un rapport obsolète : les claims encore valides + leurs remplaçants. */
export function redraftSelection(ws: Workspace, report: Report): string[] {
  const current = new Map(ws.claims.map((c) => [c.id, c]));
  const out: string[] = [];
  const push = (id: string) => void (!out.includes(id) && current.has(id) && out.push(id));
  for (const id of report.claimIds) {
    if (current.has(id)) {
      push(id);
      continue;
    }
    const old = report.claimsSnapshot.find((c) => c.id === id);
    if (!old) continue;
    const change = (ws.impacts ?? []).flatMap((i) => i.changes).find((ch) => ch.id === id && ch.replacedBy.length);
    const repl = change?.replacedBy ?? ws.claims.filter((c) => family(c.indicator) === family(old.indicator) && !report.claimIds.includes(c.id)).map((c) => c.id);
    repl.forEach(push);
  }
  return out;
}
