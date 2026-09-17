import type { Evidence, EvidenceType, LockedRule, Workspace } from "./types";

/** initial.json du cas C08 — fourni par DaiL, NON MODIFIÉ. */
export const C08_INITIAL = {
  case_id: "C08",
  data_status: "SYNTHETIC EXERCISE DATA; not real client, country, programme or participant data",
  clock: "Exercise-local time only; no real event date implied",
  programme: { id: "PRG-SYN", name: "Fictional workshop pilot", reporting_period: "Exercise week 1" },
  evidence: [
    { id: "PLAN-A", type: "plan", text: "Plan capacity: 20 participants. This is a target, not attendance." },
    { id: "SHEET-A", type: "attendance", text: "12 unique participants attended at least one session." },
    {
      id: "VOICE-A",
      type: "voice-note-transcript",
      text: "We trained twenty people this week. I mean the programme was planned for twenty; I need to check completion.",
    },
    { id: "ASSESS-A", type: "assessment", text: "No completion assessment has been submitted." },
  ],
  reviewer_notes: [{ id: "NOTE-A", text: "Use attended for the attendance figure. Do not report completed without the assessment." }],
  rules: [
    "Every numeric claim states unit, period and evidence record.",
    "A draft report stays draft until a reviewer approves it.",
    "No inference about outcomes from participation alone.",
  ],
};

/** Contexte client donné par DaiL (Yassine Bekri) : le nom peut être utilisé ; les pièces restent fictives. */
export const CLIENT_NAME = "Schmitz-Stiftungen";

/** Traductions affichées des règles fournies (le texte anglais fourni reste la référence). */
const RULE_DE: Record<string, string> = {
  "Every numeric claim states unit, period and evidence record.": "Jede Zahlenaussage nennt Einheit, Berichtszeitraum und Beleg.",
  "A draft report stays draft until a reviewer approves it.": "Ein Berichtsentwurf bleibt Entwurf, bis eine prüfende Person ihn freigibt.",
  "No inference about outcomes from participation alone.": "Aus der Teilnahme allein werden keine Wirkungen abgeleitet.",
  "Use attended for the attendance figure. Do not report completed without the assessment.":
    "Für die Teilnahmezahl „teilgenommen“ verwenden. Einen Abschluss nicht ohne Abschlussnachweis berichten.",
};
const RULE_ENFORCEMENT_DE: Record<string, string> = {
  "Every numeric claim states unit, period and evidence record.":
    "Berichtsansicht: Jede Zahl trägt Einheit, Zeitraum und Beleg; die Prüfung weist Zahlen ohne Aussage zurück.",
  "A draft report stays draft until a reviewer approves it.":
    "Ablauf: Der Graph hält an einem Prüfpunkt; nur eine zweite, namentlich genannte Person kann freigeben (Vier-Augen-Prinzip).",
  "No inference about outcomes from participation alone.":
    "Obergrenze je Belegart: Eine Teilnahmeliste belegt nie Abschluss oder Wirkung; die Wirkungskette zeigt „Wirkung: nicht belegbar“.",
  "Use attended for the attendance figure. Do not report completed without the assessment.":
    "Obergrenze + Fehlen-Regel: Der Abschluss bleibt „noch kein Nachweis“, bis ein Abschlussnachweis vorliegt.",
};

const RULE_ENFORCEMENT: Record<string, string> = {
  "Every numeric claim states unit, period and evidence record.":
    "Report renderer: every figure carries its unit, period and evidence chip; the checker rejects figures without a claim.",
  "A draft report stays draft until a reviewer approves it.":
    "Report workflow: the graph stops at a human checkpoint; only a named reviewer can approve.",
  "No inference about outcomes from participation alone.":
    "Evidence ceiling: an attendance record can never prove completion or outcomes.",
  "Use attended for the attendance figure. Do not report completed without the assessment.":
    "Evidence ceiling + absence rule: completion is “unknown” until an assessment record exists.",
};

export function rulesFromInitial(data: { reviewer_notes?: { id: string; text: string }[]; rules?: string[] }, now: string): LockedRule[] {
  const out: LockedRule[] = [];
  for (const n of data.reviewer_notes ?? [])
    out.push({
      id: n.id, text: n.text, source: "supplied-reviewer-note", sourceRef: n.id, createdAt: now, active: true,
      enforcedBy: RULE_ENFORCEMENT[n.text] ?? "Injected into the report writer as a locked instruction.",
      textDe: RULE_DE[n.text],
      enforcedByDe: RULE_ENFORCEMENT_DE[n.text] ?? "Wird dem Berichtsschreiber als feste Anweisung mitgegeben.",
    });
  (data.rules ?? []).forEach((r, i) =>
    out.push({
      id: `RULE-${i + 1}`, text: r, source: "supplied-reviewer-note", sourceRef: "initial.json rules", createdAt: now, active: true,
      enforcedBy: RULE_ENFORCEMENT[r] ?? "Injected into the report writer as a locked instruction.",
      textDe: RULE_DE[r],
      enforcedByDe: RULE_ENFORCEMENT_DE[r] ?? "Wird dem Berichtsschreiber als feste Anweisung mitgegeben.",
    }),
  );
  return out;
}

export function evidenceFromInitial(
  data: { evidence?: { id: string; type: string; text: string }[] },
  origin: Evidence["origin"],
  now: string,
  fileName?: string,
): Evidence[] {
  return (data.evidence ?? []).map((e) => ({
    id: e.id,
    type: normalizeType(e.type),
    text: e.text,
    origin,
    fileName,
    addedAt: now,
    typeConfirmed: true, // le type est donné par la pièce elle-même
  }));
}

export function normalizeType(t: string): EvidenceType {
  const x = t.toLowerCase();
  if (x.includes("plan")) return "plan";
  if (x.includes("attend") || x.includes("sheet") || x.includes("émargement")) return "attendance";
  if (x.includes("assess") || x.includes("évaluation")) return "assessment";
  if (x.includes("voice")) return "voice-note-transcript";
  if (x.includes("coordinator")) return "coordinator-note";
  if (x.includes("partner") || x.includes("field")) return "partner-report";
  if (x.includes("review")) return "reviewer-note";
  return "other";
}

export function frenchPackState(): Workspace {
  const now = new Date().toISOString();
  return {
    ...startState(),
    caseName: `${CLIENT_NAME} · Site C French field pack (SIMULATED)`,
    period: "Programme period (site C)",
    evidence: SIMULATIONS.french_pack.evidence.map((e) => ({ ...e, addedAt: now })),
    rules: rulesFromInitial({ rules: C08_INITIAL.rules }, now),
  };
}

export function germanPackState(): Workspace {
  const now = new Date().toISOString();
  return {
    ...startState(),
    caseName: `${CLIENT_NAME} · Standort D, deutschsprachige Belege (SIMULIERT)`,
    period: "Berichtszeitraum Standort D (fiktiv)",
    evidence: SIMULATIONS.german_pack.evidence.map((e) => ({ ...e, addedAt: now })),
    rules: rulesFromInitial({ rules: C08_INITIAL.rules }, now),
  };
}

export function startState(): Workspace {
  const now = new Date().toISOString();
  return {
    caseName: `${CLIENT_NAME} · ${C08_INITIAL.programme.name}`,
    client: CLIENT_NAME,
    period: C08_INITIAL.programme.reporting_period,
    evidence: evidenceFromInitial(C08_INITIAL, "supplied", now, "initial.json"),
    claims: [],
    bag: [],
    analyses: [],
    reports: [],
    rules: rulesFromInitial(C08_INITIAL, now),
    feedbackLog: [],
    claimKeys: {},
    bagMeta: {},
    updatedAt: now,
  };
}

/** Événements SIMULÉS, clairement étiquetés (consigne du brief). */
export const SIMULATIONS: Record<
  string,
  { label: string; description: string; labelDe: string; descriptionDe: string; evidence: Omit<Evidence, "addedAt">[] }
> = {
  assessment: {
    label: "Late assessment arrives",
    description: "The project partner submits the completion assessment later in the week.",
    labelDe: "Abschlussnachweis wird nachgereicht",
    descriptionDe: "Der Projektpartner reicht den Abschlussnachweis später in der Woche nach.",
    evidence: [
      {
        id: "SIM-ASSESS-B", type: "assessment", origin: "simulated", typeConfirmed: true,
        text: "[SIMULATED] Completion assessment: 9 participants completed all four sessions.",
      },
    ],
  },
  coordinator: {
    label: "Coordinator update",
    description: "A coordinator mentions extra participants that are not on the sheet yet.",
    labelDe: "Vermerk der Koordination",
    descriptionDe: "Die Koordination erwähnt weitere Teilnehmende, die noch nicht auf der Liste stehen.",
    evidence: [
      {
        id: "SIM-COORD-B", type: "coordinator-note", origin: "simulated", typeConfirmed: true,
        text: "[SIMULATED] Two more people joined on Friday; the attendance sheet has not been updated yet.",
      },
    ],
  },
  french_pack: {
    label: "Load site C — French field pack (hard traps)",
    description: "Replaces the case with a second, simulated site: a double-counting trap and a headcount that includes parents.",
    labelDe: "Standort C laden – französischsprachige Belege (schwierige Fallen)",
    descriptionDe: "Ersetzt den Fall durch einen zweiten, simulierten Standort: Doppelzählung und eine Zählung inklusive Eltern.",
    evidence: [
      { id: "SIM-PLAN-C", type: "plan", origin: "simulated", typeConfirmed: true, text: "[SIMULÉ] Objectif du programme : 25 bénéficiaires." },
      {
        id: "SIM-SHEET-C", type: "attendance", origin: "simulated", typeConfirmed: true,
        text: "[SIMULÉ] Liste d'émargement : 15 signatures lundi, 9 signatures mardi. 7 personnes ont signé les deux jours.",
      },
      {
        id: "SIM-VOICE-C", type: "voice-note-transcript", origin: "simulated", typeConfirmed: true,
        text: "[SIMULÉ] On a touché une trentaine de personnes, enfin en comptant les parents qui accompagnaient ; les inscrits c'est plutôt 17, je crois.",
      },
      { id: "SIM-ASSESS-C", type: "assessment", origin: "simulated", typeConfirmed: true, text: "[SIMULÉ] Évaluation finale : 10 participants ont réussi le test." },
    ],
  },
  german_pack: {
    label: "Load site D — German-language pack (fictional German partner)",
    description: "Replaces the case with a simulated German-language pack: a corrected figure in a voice note and a missing completion record.",
    labelDe: "Standort D laden – deutschsprachige Belege (fiktiver Träger)",
    descriptionDe: "Ersetzt den Fall durch simulierte deutschsprachige Belege: eine korrigierte Zahl in einer Sprachnachricht und ein fehlender Abschlussnachweis.",
    evidence: [
      { id: "SIM-PLAN-D", type: "plan", origin: "simulated", typeConfirmed: true, text: "[SIMULIERT] Planung: 30 Plätze für Teilnehmende im Berichtszeitraum." },
      {
        id: "SIM-LISTE-D", type: "attendance", origin: "simulated", typeConfirmed: true,
        text: "[SIMULIERT] Teilnahmeliste: 18 Personen haben an mindestens einer Sitzung teilgenommen.",
      },
      {
        id: "SIM-SPRACH-D", type: "voice-note-transcript", origin: "simulated", typeConfirmed: true,
        text: "[SIMULIERT] Wir haben dreißig Leute geschult, ich meine, geplant waren dreißig; den Abschluss muss ich noch prüfen.",
      },
      { id: "SIM-ABSCHL-D", type: "assessment", origin: "simulated", typeConfirmed: true, text: "[SIMULIERT] Ein Abschlussnachweis liegt noch nicht vor." },
    ],
  },
};
