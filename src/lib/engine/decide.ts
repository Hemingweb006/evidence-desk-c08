import { lt, type Lang, type LText } from "../i18n/core";
import { EVIDENCE_TYPE_L, INDICATOR_L, STATUS_L, UNIT_L } from "../i18n/terms";
import type { Check, Claim, ClaimStatus, Confusion, Evidence, Indicator, Mention, Reading } from "../types";
import { APPROX_WORDS, CEILING, INDICATOR_LABEL, NUMBER_WORDS, STATUS_RANK } from "./lexicon";
import { clauseOf, codeCues, hasAbsence, normalizeForQuote, sentenceOf, unitNoun } from "./mentions";

export interface QuestionItem {
  evidence: Evidence;
  mention: Mention;
  question: string;
  options: Indicator[];
  source: "model" | "template";
}

export type DraftClaim = Omit<Claim, "id" | "analysisId" | "summary" | "risk" | "advice" | "textSource" | "confusions" | "incoherence">;

/** Libellé anglais (prompts, exports) ; l'interface utilise claimView(). */
export const claimLabel = (c: { headline?: string; indicator: Indicator }) => c.headline ?? INDICATOR_LABEL[c.indicator];

export const fmt = (v: number | null) => (v === null ? "—" : String(v));

const lowerL = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const ind = (i: Indicator): LText => ({ de: INDICATOR_L.de[i], en: lowerL(INDICATOR_L.en[i]) });
const evt = (e: Evidence["type"]): LText => ({ de: EVIDENCE_TYPE_L.de[e], en: EVIDENCE_TYPE_L.en[e] });

/** Messages du moteur, dans les deux langues. */
const MSG = {
  disagree: lt("Die beiden unabhängigen Auswertungen deuten die Zahl unterschiedlich", "The two independent readings disagree on what the number means"),
  unclear: lt("Die Bedeutung der Zahl ist unklar", "The meaning of the number is unclear"),
  badQuote: lt("Eine Auswertung zitiert Text, der so nicht im Beleg steht", "A reader quoted text that is not in the evidence"),
  notPeople: (noun: string) => lt(`Die Zahl zählt „${noun}“, keine Personen`, `The number counts “${noun}”, not people`),
  notSessions: (noun: string) => lt(`Die Zahl zählt „${noun}“, keine Sitzungen`, `The number counts “${noun}”, not sessions`),
  retracted: lt("Die sprechende Person korrigiert oder widerruft diese Zahl", "The speaker corrects or withdraws this figure"),
  hedged: lt("Die Zahl wird mit Unsicherheit oder als Schätzung genannt", "The figure is stated with hesitation or as an approximation"),
  mixed: lt("Die Zählung schließt Nicht-Teilnehmende ein", "The count includes non-participants"),
  reported: lt("Die Zahl wird von jemandem berichtet, nicht dokumentiert", "The figure is reported by someone, not recorded"),
  absent: lt("Der Beleg sagt, dass diese Information nicht vorliegt", "The evidence says this information is not available"),
  ceiling: (e: Evidence["type"], i: Indicator) =>
    lt(`Ein Beleg der Art „${EVIDENCE_TYPE_L.de[e]}“ kann „${INDICATOR_L.de[i]}“ allein nicht belegen`, `A ${EVIDENCE_TYPE_L.en[e].toLowerCase()} cannot prove “${INDICATOR_L.en[i].toLowerCase()}” on its own`),
  noRecord: lt("Noch kein Nachweis – die Zahl ist unbekannt, nicht null", "No record yet — the figure is unknown, not zero"),
  conflict: lt("Zwei Belege nennen unterschiedliche Werte für dieselbe Kennzahl", "Two records give different values for the same figure"),
  derived: lt("Vom Code aus belegten Werten desselben Belegs berechnet (keine Rechnung durch ein Modell)", "Derived by code from verified figures of the same record (no model arithmetic)"),
};

const CHECK = {
  agree: lt("Unabhängige Auswertungen stimmen überein", "Independent readings agree"),
  clear: lt("Bedeutung der Zahl ist eindeutig", "Meaning of the number is clear"),
  quote: lt("Zitierter Satz steht wörtlich im Beleg", "Quoted sentence exists word-for-word"),
  unit: lt("Einheit passt zur Bedeutung", "Unit agrees with the meaning"),
  noRetract: lt("Keine Korrektur nach der Zahl", "No correction after the number"),
  noHedge: lt("Keine unsichere Formulierung um die Zahl", "No hedging around the number"),
  onlyParticipants: lt("Zählt nur Teilnehmende", "Counts only participants"),
  ceiling: lt("Belegart kann dies belegen", "Evidence type can prove this"),
  absence: lt("Ausdrückliches Fehlen per Regel erkannt", "Explicit absence detected by rule"),
  noConflict: lt("Kein widersprüchlicher Beleg", "No conflicting record"),
  inputs: lt("Eingangswerte sind belegt und stammen aus demselben Beleg", "Inputs are verified and from the same record"),
};

function mkCheck(name: LText, pass: boolean, detail?: LText): Check {
  return { name: name.en, pass, detail: detail?.en, de: { name: name.de, detail: detail?.de } };
}

/**
 * LE CODE DÉCIDE. Chaque contrôle ne peut que FAIRE BAISSER le statut.
 * Les lectures du modèle ne sont que des indices.
 */
export function decide(q: QuestionItem, readings: Reading[], period: string): DraftClaim {
  const { evidence: ev, mention: m } = q;
  let status: ClaimStatus = "VERIFIED";
  const ranked: { why: LText; rank: number }[] = [];
  const checks: Check[] = [];
  const lower = (to: ClaimStatus, why: LText) => {
    if (STATUS_RANK[to] < STATUS_RANK[status]) status = to;
    if (!ranked.some((r) => r.why.en === why.en)) ranked.push({ why, rank: STATUS_RANK[to] });
  };

  const choices = [...new Set(readings.map((r) => r.choice))];
  let indicator: Indicator = readings[0]?.choice ?? "unclear";
  const agree = choices.length === 1;
  checks.push(mkCheck(CHECK.agree, agree, agree ? undefined : lt(`Auswertungen: ${choices.join(" vs. ")}`, `readers chose: ${choices.join(" vs ")}`)));
  if (!agree) {
    lower("UNCERTAIN", MSG.disagree);
    indicator = choices.includes("unclear") ? "unclear" : [...choices].sort()[0];
  }

  const clear = indicator !== "unclear" && indicator !== "other";
  checks.push(mkCheck(CHECK.clear, clear));
  if (!clear) lower("UNCERTAIN", MSG.unclear);

  const nr = normalizeForQuote(ev.text);
  const badQuote = readings.some((r) => {
    const ns = normalizeForQuote(r.sentence ?? "");
    return ns.length > 0 && !nr.includes(ns) && !ns.includes(nr);
  });
  checks.push(mkCheck(CHECK.quote, !badQuote));
  if (badQuote) lower("UNCERTAIN", MSG.badQuote);

  const unit = unitNoun(ev, m);
  let unitOk = true;
  if (unit.kind === "days" && clear && indicator !== "sessions") {
    unitOk = false;
    lower("UNCERTAIN", MSG.notPeople(unit.noun));
    indicator = "sessions";
  }
  if (unit.kind === "people" && indicator === "sessions") {
    unitOk = false;
    lower("UNCERTAIN", MSG.notSessions(unit.noun));
  }
  checks.push(mkCheck(CHECK.unit, unitOk, unit.noun ? lt(`gefolgt von „${unit.noun}“`, `followed by “${unit.noun}”`) : undefined));

  const cues = codeCues(ev, m);
  const retract = cues.filter((c) => c.kind === "retracted");
  const hedge = cues.filter((c) => c.kind === "hedged");
  const mods = new Set(readings.map((r) => r.modality));
  checks.push(
    mkCheck(
      CHECK.noRetract,
      retract.length === 0 && !mods.has("retracted"),
      retract.length
        ? lt(`Regel fand „${retract[0].cue}“ weiter hinten im Text`, `rule found “${retract[0].cue}” later in the text`)
        : mods.has("retracted")
          ? lt("eine Auswertung meldet eine Korrektur", "reader flagged a correction")
          : undefined,
    ),
  );
  if (retract.length || mods.has("retracted")) lower("MISLEADING", MSG.retracted);

  checks.push(
    mkCheck(
      CHECK.noHedge,
      hedge.length === 0 && !mods.has("hedged"),
      hedge.length
        ? lt(`Regel fand „${hedge[0].cue === "approximation" ? "Schätzwort" : hedge[0].cue}“`, `rule found “${hedge[0].cue}”`)
        : mods.has("hedged")
          ? lt("eine Auswertung meldet Unsicherheit", "reader flagged hedging")
          : undefined,
    ),
  );
  if (hedge.length || mods.has("hedged")) lower("UNCERTAIN", MSG.hedged);

  const mixed = indicator === "reached_incl_others";
  checks.push(mkCheck(CHECK.onlyParticipants, !mixed));
  if (mixed) lower("MISLEADING", MSG.mixed);

  if (mods.has("reported")) lower("UNCERTAIN", MSG.reported);
  if (mods.has("absent")) lower("UNKNOWN", MSG.absent);

  const allowed = CEILING[ev.type] ?? [];
  const canProve = !clear || allowed.includes(indicator);
  checks.push(
    mkCheck(
      CHECK.ceiling,
      allowed.includes(indicator),
      lt(
        `${EVIDENCE_TYPE_L.de[ev.type]} kann belegen: ${allowed.length ? allowed.map((a) => INDICATOR_L.de[a]).join(", ") : "allein nichts"}`,
        `${EVIDENCE_TYPE_L.en[ev.type]} can prove: ${allowed.length ? allowed.map((a) => INDICATOR_L.en[a]).join(", ") : "nothing on its own"}`,
      ),
    ),
  );
  if (!canProve) lower("UNCERTAIN", MSG.ceiling(ev.type, indicator));

  if (status === "VERIFIED" && indicator === "planned") status = "TARGET";
  // la raison la plus grave d'abord (c'est elle qui explique le statut)
  const sorted = ranked.sort((a, b) => a.rank - b.rank).map((r) => r.why);

  // ce que l'énoncé AFFIRME littéralement, quand c'est lui qui est trompeur
  const clause = clauseOf(ev.text, m.pos).replace(/[.;]$/, "");
  const headline: LText | undefined =
    retract.length || mods.has("retracted")
      ? lt(`Genannt, dann korrigiert: „${clause}“`, `Stated, then corrected: “${clause}”`)
      : mixed
        ? lt("Zählung inklusive Nicht-Teilnehmender", "Headcount that includes non-participants")
        : undefined;

  return {
    value: m.value,
    surface: m.surface,
    headline: headline?.en,
    unit: indicator === "sessions" || unit.kind === "days" ? "sessions" : "people",
    indicator,
    period,
    evidenceId: ev.id,
    evidenceType: ev.type,
    quote: sentenceOf(ev.text, m.pos),
    status,
    reasons: sorted.map((r) => r.en),
    checks,
    question: q.question,
    readings,
    de: { headline: headline?.de, reasons: sorted.map((r) => r.de), summary: "", risk: "", advice: "", textSource: "template" },
  };
}

const pushReason = (c: DraftClaim | Claim, why: LText) => {
  c.reasons.push(why.en);
  if (c.de) c.de.reasons.push(why.de);
};

/** Absences explicites, contradictions, dérivations : tout est fait par le code. */
export function reconcile(drafts: DraftClaim[], evidence: Evidence[], period: string, mentionsByEvidence: Map<string, Mention[]>): DraftClaim[] {
  const out = [...drafts];
  const hasVerified = (i: Indicator) => out.some((c) => c.indicator === i && c.status === "VERIFIED");

  // « aucune évaluation » = inconnu, jamais zéro
  for (const ev of evidence) {
    if (ev.type !== "assessment" && ev.type !== "attendance") continue;
    const absence = hasAbsence(ev.text);
    if (!absence || (mentionsByEvidence.get(ev.id)?.length ?? 0) > 0) continue;
    const i: Indicator = ev.type === "assessment" ? "completed" : "attended";
    if (hasVerified(i) || (i === "completed" && hasVerified("passed"))) continue;
    out.push({
      value: null, surface: "", unit: "people", indicator: i, period, evidenceId: ev.id, evidenceType: ev.type,
      quote: ev.text, status: "UNKNOWN",
      reasons: [MSG.noRecord.en],
      checks: [mkCheck(CHECK.absence, true, lt(`„${absence}“`, `“${absence}”`))],
      question: "", readings: [],
      de: { reasons: [MSG.noRecord.de], summary: "", risk: "", advice: "", textSource: "template" },
    });
  }

  // même indicateur prouvé avec deux valeurs différentes → incertain
  for (const i of ["attended", "completed", "passed", "enrolled"] as Indicator[]) {
    const values = new Set(out.filter((c) => c.indicator === i && c.status === "VERIFIED").map((c) => c.value));
    if (values.size > 1) {
      for (const c of out)
        if (c.indicator === i && c.status === "VERIFIED") {
          c.status = "UNCERTAIN";
          pushReason(c, MSG.conflict);
          c.checks.push(mkCheck(CHECK.noConflict, false));
        }
    }
  }
  return out;
}

/** Participants uniques = jour A + jour B − présents les deux jours (même feuille, valeurs vérifiées). */
export function derive(claims: Claim[], period: string, analysisId: string, nextId: () => string): Claim[] {
  const out: Claim[] = [];
  const byEv = new Map<string, Claim[]>();
  for (const c of claims) if (c.status === "VERIFIED") byEv.set(c.evidenceId, [...(byEv.get(c.evidenceId) ?? []), c]);
  for (const [evId, cs] of byEv) {
    const days = cs.filter((c) => c.indicator === "attended_day");
    const overlap = cs.filter((c) => c.indicator === "attended_overlap");
    const already = claims.some((c) => c.evidenceId === evId && c.indicator === "attended");
    if (days.length === 2 && overlap.length === 1 && !already) {
      const v = days[0].value! + days[1].value! - overlap[0].value!;
      const formula = `${days[0].id} + ${days[1].id} − ${overlap[0].id} = ${fmt(days[0].value)} + ${fmt(days[1].value)} − ${fmt(overlap[0].value)}`;
      const inputs = [days[0], days[1], overlap[0]];
      out.push({
        id: nextId(), analysisId, value: v, surface: String(v), unit: "people", indicator: "attended", period,
        evidenceId: evId, evidenceType: "attendance",
        quote: `Computed by code: ${formula}`,
        derivation: `${days[0].id} + ${days[1].id} − ${overlap[0].id}`,
        status: "VERIFIED",
        reasons: [MSG.derived.en],
        checks: [mkCheck(CHECK.inputs, true)],
        question: "", readings: [],
        confusions: inputs.map((c) => ({
          claimId: c.id,
          kind: "derived_from" as const,
          note: `Input: ${fmt(c.value)} (${ind(c.indicator).en})`,
          noteDe: `Eingangswert: ${fmt(c.value)} (${ind(c.indicator).de})`,
        })),
        incoherence: 0, summary: "", risk: "", advice: "", textSource: "template",
        de: { reasons: [MSG.derived.de], quote: `Vom Code berechnet: ${formula}`, summary: "", risk: "", advice: "", textSource: "template" },
      });
    }
  }
  return out;
}

export function findConfusions(c: Claim, all: Claim[]): Confusion[] {
  const out: Confusion[] = [...c.confusions.filter((x) => x.kind === "derived_from")];
  const st = (s: ClaimStatus) => ({ de: STATUS_L.de[s], en: STATUS_L.en[s].toLowerCase() });
  for (const o of all) {
    if (o.id === c.id || c.value === null || o.value === null) continue;
    if (o.value === c.value && o.indicator !== c.indicator) {
      out.push({
        claimId: o.id,
        kind: "same_number_other_meaning",
        note: `Same number (${fmt(c.value)}) as ${o.id}, which means “${ind(o.indicator).en}” (${st(o.status).en}) — do not merge them.`,
        noteDe: `Gleiche Zahl (${fmt(c.value)}) wie ${o.id}, dort mit der Bedeutung „${ind(o.indicator).de}“ (${st(o.status).de}) – nicht zusammenführen.`,
      });
    } else if (o.value === c.value && o.indicator === c.indicator && o.evidenceId !== c.evidenceId && o.status !== c.status) {
      out.push({
        claimId: o.id,
        kind: "same_number_other_meaning",
        note: `${o.id} repeats this number from ${o.evidenceId} but is ${st(o.status).en} there.`,
        noteDe: `${o.id} wiederholt diese Zahl aus ${o.evidenceId}, dort aber mit dem Status „${st(o.status).de}“.`,
      });
    } else if (o.indicator === c.indicator && o.value !== c.value && c.indicator !== "sessions" && c.indicator !== "unclear") {
      out.push({
        claimId: o.id,
        kind: "same_indicator_other_value",
        note: `${o.id} gives a different value (${fmt(o.value)}) for the same figure.`,
        noteDe: `${o.id} nennt für dieselbe Kennzahl einen anderen Wert (${fmt(o.value)}).`,
      });
    }
  }
  return out;
}

export function incoherenceScore(c: Claim): number {
  const base: Record<ClaimStatus, number> = { VERIFIED: 4, TARGET: 12, UNCERTAIN: 45, UNKNOWN: 55, MISLEADING: 85 };
  const failed = c.checks.filter((x) => !x.pass && x.name !== CHECK.ceiling.en).length;
  const conf = c.confusions.filter((x) => x.kind !== "derived_from").length;
  const score = base[c.status] + failed * 6 + conf * 4;
  const cap: Record<ClaimStatus, [number, number]> = { VERIFIED: [0, 20], TARGET: [5, 30], UNCERTAIN: [35, 75], UNKNOWN: [45, 75], MISLEADING: [80, 100] };
  return Math.max(cap[c.status][0], Math.min(cap[c.status][1], score));
}

type CardText = Pick<Claim, "summary" | "risk" | "advice">;

/** Textes de secours, 100 % déterministes, dans la langue demandée. */
export function templateTexts(c: Claim, lang: Lang = "en"): CardText {
  const label = ind(c.indicator)[lang];
  const evType = evt(c.evidenceType)[lang];
  const v = `${fmt(c.value)} ${UNIT_L[lang][c.unit]}`;
  const reason0 = (lang === "de" ? c.de?.reasons[0] : c.reasons[0]) ?? "";
  if (lang === "de") {
    switch (c.status) {
      case "VERIFIED":
        return {
          summary: c.derivation ? `${v} – ${label}, berechnet aus dem Beleg ${c.evidenceId} (${c.period}).` : `${v} – ${label}, dokumentiert in ${c.evidenceId} (${c.period}).`,
          risk: `Gering. Gestützt auf: ${evType}.`,
          advice: `Als „${v}, ${label}“ berichten, mit Verweis auf ${c.evidenceId} und den Berichtszeitraum.`,
        };
      case "TARGET":
        return {
          summary: `${v} ist ein Planwert aus ${c.evidenceId}, kein erreichtes Ergebnis.`,
          risk: "Mittel, wenn als Ergebnis formuliert: Planwerte werden leicht als Ist-Werte gelesen.",
          advice: "Nur als Planwert (Soll) berichten, neben dem belegten Ist-Wert.",
        };
      case "UNCERTAIN":
        return {
          summary: `${v} (${label}) steht in ${c.evidenceId}, lässt sich mit diesem Beleg aber nicht bestätigen.`,
          risk: `Mittel. ${reason0 || "Der Beleg reicht nicht aus."}`,
          advice: "Nicht unter den belegten Ergebnissen aufführen. Beim Projektpartner einen bestätigenden Nachweis anfordern.",
        };
      case "UNKNOWN":
        return {
          summary: `Noch kein Nachweis für „${label}“. ${c.evidenceId} gibt an, dass er nicht vorliegt.`,
          risk: "Hoch, wenn als null berichtet oder geschätzt.",
          advice: "Als „noch nicht belegt“ berichten und den fehlenden Nachweis anfordern.",
        };
      case "MISLEADING":
        return {
          summary: `„${c.surface}“ in ${c.evidenceId} ist als Ergebnis nicht berichtsfähig.`,
          risk: `Hoch. ${reason0 || "Die Zahl ist irreführend."}`,
          advice: "Diese Zahl nicht als Ergebnis berichten. Wird sie erwähnt, den Ausschluss begründen.",
        };
    }
  }
  switch (c.status) {
    case "VERIFIED":
      return {
        summary: c.derivation ? `${v} — ${label}, computed from the ${c.evidenceId} record (${c.period}).` : `${v} — ${label}, recorded in ${c.evidenceId} (${c.period}).`,
        risk: `Low. Backed by: ${evType.toLowerCase()}.`,
        advice: `Report as “${v} ${label}”, citing ${c.evidenceId} and the period.`,
      };
    case "TARGET":
      return {
        summary: `${v} is a planned target set in ${c.evidenceId}, not an achieved result.`,
        risk: "Medium if worded as an achievement: targets are often read as results.",
        advice: "Report only as a target, next to the verified actual figure.",
      };
    case "UNCERTAIN":
      return {
        summary: `${v} (${label}) appears in ${c.evidenceId}, but it cannot be confirmed from this evidence.`,
        risk: `Medium. ${reason0 || "The evidence is not strong enough."}`,
        advice: "Keep out of verified results. Ask the project partner for a record that confirms it.",
      };
    case "UNKNOWN":
      return {
        summary: `No evidence yet for “${label}”. ${c.evidenceId} says it is not available.`,
        risk: "High if reported as zero or guessed.",
        advice: "Report as “not yet evidenced” and request the missing record.",
      };
    case "MISLEADING":
      return {
        summary: `“${c.surface}” in ${c.evidenceId} is not reportable as a result.`,
        risk: `High. ${reason0 || "The figure is misleading."}`,
        advice: "Do not report this figure as a result. If it is mentioned, explain why it was excluded.",
      };
  }
}

/** Applique les textes de secours dans les deux langues. */
export function applyTemplates(c: Claim) {
  Object.assign(c, templateTexts(c, "en"), { textSource: "template" as const });
  c.de = { reasons: c.reasons, ...c.de, ...templateTexts(c, "de"), textSource: "template" };
}

/** Nombres autorisés dans un texte qui parle de ces claims. */
export function allowedNumbers(claims: Claim[], all: Claim[]): Set<number> {
  const s = new Set<number>([1]);
  const byId = new Map(all.map((c) => [c.id, c]));
  for (const c of claims) {
    if (c.value !== null) s.add(c.value);
    for (const x of c.confusions) {
      const o = byId.get(x.claimId);
      if (o?.value != null) s.add(o.value);
    }
    for (const m of c.period.matchAll(/\d+/g)) s.add(Number(m[0]));
    for (const r of [...c.reasons, ...(c.de?.reasons ?? [])]) for (const n of numbersIn(r)) s.add(n); // textes produits par le code
  }
  return s;
}

export function numbersIn(text: string): number[] {
  const cleaned = text.replace(/\b(?:C|R|v)\d+\b/g, "").replace(/\b[A-Z]+(?:-[A-Z0-9]+)+\b/g, "");
  const out: number[] = [];
  for (const m of cleaned.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(Number(m[0].replace(",", ".")));
  for (const m of cleaned.matchAll(/[\p{L}]+/gu)) {
    const w = m[0].toLowerCase();
    if (w in NUMBER_WORDS) out.push(NUMBER_WORDS[w]);
    else if (w in APPROX_WORDS) out.push(APPROX_WORDS[w]);
  }
  return out;
}
