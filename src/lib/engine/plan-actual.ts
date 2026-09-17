import type { ChainLevel, Claim, ClaimStatus, Indicator, PlanActual, PlanActualRow } from "../types";

/**
 * Soll-Ist-Vergleich et Wirkungskette — 100 % code, à partir des claims choisis.
 * Une Abweichung (écart) ≥ SEUIL entre Soll et Ist doit être justifiée avant la Freigabe.
 */
export const DEVIATION_THRESHOLD_PCT = 10;

const FAMILY: Record<PlanActualRow["key"], Indicator[]> = {
  participants: ["attended", "enrolled", "attended_day", "attended_overlap", "reached_incl_others"],
  completion: ["completed"],
  passed: ["passed"],
  sessions: ["sessions"],
};
const OPEN: ClaimStatus[] = ["UNCERTAIN", "UNKNOWN"];

function row(key: PlanActualRow["key"], claims: Claim[]): PlanActualRow {
  const fam = FAMILY[key];
  const inFam = claims.filter((c) => fam.includes(c.indicator));
  // Soll : seulement les Planwerte en personnes, pour la ligne « Teilnehmende »
  const target = key === "participants" ? claims.find((c) => c.status === "TARGET" && c.indicator === "planned" && c.unit === "people" && c.value !== null) : undefined;
  // Ist : la valeur belegte la plus directe (participants uniques d'abord)
  const verified = inFam.filter((c) => c.status === "VERIFIED" && c.value !== null);
  const best = key === "participants" ? verified.find((c) => c.indicator === "attended") ?? verified.find((c) => c.indicator === "enrolled") : verified[0];
  const soll = target ? { value: target.value!, claimId: target.id, evidenceId: target.evidenceId } : undefined;
  const ist = best ? { value: best.value!, claimId: best.id, evidenceId: best.evidenceId, derived: !!best.derivation } : undefined;
  const open = inFam.filter((c) => OPEN.includes(c.status)).map((c) => ({ claimId: c.id, status: c.status, value: c.value, evidenceId: c.evidenceId }));
  // Nicht berichtsfähig : dans la famille, ou un « planned » corrigé qui se fait passer pour un résultat
  const excluded = claims
    .filter((c) => c.status === "MISLEADING" && (fam.includes(c.indicator) || (key === "participants" && c.indicator === "planned")))
    .map((c) => ({ claimId: c.id, value: c.value, evidenceId: c.evidenceId, equalsSoll: !!soll && c.value === soll.value }));
  const deviation = soll && ist ? { abs: ist.value - soll.value, pct: Math.round(((ist.value - soll.value) / soll.value) * 100) } : undefined;
  return { key, soll, ist, open, excluded, deviation, needsJustification: !!deviation && Math.abs(deviation.pct) >= DEVIATION_THRESHOLD_PCT };
}

function level(key: ChainLevel["key"], claims: Claim[], indicators: Indicator[], statusOk: ClaimStatus[]): ChainLevel {
  const hits = claims.filter((c) => indicators.includes(c.indicator));
  const ok = hits.filter((c) => statusOk.includes(c.status));
  const open = hits.filter((c) => OPEN.includes(c.status));
  return {
    key,
    state: ok.length ? "evidenced" : open.length ? "open" : "none",
    claimIds: (ok.length ? ok : open).map((c) => c.id),
  };
}

export function computePlanActual(claims: Claim[]): PlanActual {
  const rows: PlanActualRow[] = [row("participants", claims), row("completion", claims)];
  for (const k of ["passed", "sessions"] as const) {
    const r = row(k, claims);
    if (r.ist || r.open.length || r.excluded.length) rows.push(r);
  }
  const chain: ChainLevel[] = [
    level("plan", claims, ["planned"], ["TARGET"]),
    level("activities", claims, ["sessions"], ["VERIFIED"]),
    level("output", claims, ["attended", "enrolled", "attended_day", "attended_overlap", "completed"], ["VERIFIED"]),
    level("outcome", claims, ["passed"], ["VERIFIED"]),
    // Aucune pièce de ce type ne permet une affirmation d'impact : règle « pas d'impact déduit de la seule participation »
    { key: "impact", state: "not_claimable", claimIds: [] },
  ];
  return { rows, chain, threshold: DEVIATION_THRESHOLD_PCT };
}

/** Lignes dont l'écart doit être justifié avant la Freigabe. */
export const rowsNeedingJustification = (pa: PlanActual | undefined) => (pa?.rows ?? []).filter((r) => r.needsJustification);
