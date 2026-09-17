import type { ClaimStatus, Claim, EvidenceType, Indicator, Report, ReportSection } from "../types";
import type { Lang } from "./core";

/**
 * Vocabulaire métier. Allemand : termes des Sachberichte (Beleg, Planwert, Rückfrage, Freigabe).
 * Ton neutre envers les partenaires (« nicht berichtsfähig » plutôt que « trompeur »).
 */
export const STATUS_L: Record<Lang, Record<ClaimStatus, string>> = {
  de: { VERIFIED: "Belegt", TARGET: "Planwert (Soll)", UNCERTAIN: "Rückfrage nötig", UNKNOWN: "Noch kein Nachweis", MISLEADING: "Nicht berichtsfähig" },
  en: { VERIFIED: "Verified", TARGET: "Target (plan)", UNCERTAIN: "Needs follow-up", UNKNOWN: "No evidence yet", MISLEADING: "Not reportable" },
};

export const STATUS_HINT_L: Record<Lang, Record<ClaimStatus, string>> = {
  de: {
    VERIFIED: "Durch einen Beleg gestützt, der diese Zahl belegen kann",
    TARGET: "Ein geplanter Wert, kein Ergebnis",
    UNCERTAIN: "Genannt, mit diesem Beleg aber nicht belegbar",
    UNKNOWN: "Noch kein Nachweis – das bedeutet nicht null",
    MISLEADING: "Darf nicht als Ergebnis berichtet werden",
  },
  en: {
    VERIFIED: "Backed by a record that can prove it",
    TARGET: "A planned figure, not a result",
    UNCERTAIN: "Mentioned, but not provable from this evidence",
    UNKNOWN: "No evidence yet — not zero",
    MISLEADING: "Must not be reported as a result",
  },
};

export const INDICATOR_L: Record<Lang, Record<Indicator, string>> = {
  de: {
    planned: "Planwert / geplante Plätze",
    enrolled: "Angemeldete Teilnehmende",
    attended: "Teilnehmende (mind. eine Sitzung, eindeutig gezählt)",
    attended_day: "Anwesende an einem Tag",
    attended_overlap: "An mehreren Tagen anwesend",
    completed: "Maßnahme abgeschlossen",
    passed: "Prüfung bestanden",
    reached_incl_others: "Erreichte Personen inkl. Nicht-Teilnehmender",
    sessions: "Sitzungen / Tage",
    other: "Sonstiges",
    unclear: "Bedeutung unklar",
  },
  en: {
    planned: "Planned capacity / target",
    enrolled: "Enrolled",
    attended: "Unique participants who attended",
    attended_day: "Present on a given day",
    attended_overlap: "Present on several days",
    completed: "Completed the programme",
    passed: "Passed the assessment",
    reached_incl_others: "People reached (incl. non-participants)",
    sessions: "Sessions / days",
    other: "Other",
    unclear: "Unclear meaning",
  },
};

export const EVIDENCE_TYPE_L: Record<Lang, Record<EvidenceType, string>> = {
  de: {
    plan: "Planungsdokument",
    attendance: "Teilnahmeliste",
    assessment: "Abschlussnachweis",
    "voice-note-transcript": "Sprachnachricht (Transkript)",
    "coordinator-note": "Vermerk der Koordination",
    "partner-report": "Bericht des Projektpartners",
    "reviewer-note": "Prüfhinweis (Regel)",
    other: "Sonstiges",
  },
  en: {
    plan: "Plan",
    attendance: "Attendance record",
    assessment: "Assessment",
    "voice-note-transcript": "Voice-note transcript",
    "coordinator-note": "Coordinator note",
    "partner-report": "Partner narrative report",
    "reviewer-note": "Reviewer note (rule)",
    other: "Other",
  },
};

export const UNIT_L: Record<Lang, Record<Claim["unit"], string>> = {
  de: { people: "Personen", sessions: "Sitzungen" },
  en: { people: "people", sessions: "sessions" },
};

export const REPORT_STATUS_L: Record<Lang, Record<Report["status"], string>> = {
  de: {
    writing: "Wird erstellt",
    draft: "Entwurf – Freigabe ausstehend",
    approved: "Freigegeben",
    changes_requested: "Überarbeitung angefordert",
    outdated: "Überholt – erneute Freigabe nötig",
    error: "Fehler",
  },
  en: {
    writing: "Writing",
    draft: "Draft — awaiting approval",
    approved: "Approved",
    changes_requested: "Changes requested",
    outdated: "Outdated — needs a new approval",
    error: "Error",
  },
};

export const SECTION_TITLE_L: Record<Lang, Record<ReportSection["key"], string>> = {
  de: {
    summary: "Zusammenfassung",
    verified: "Belegte Ergebnisse (Ist)",
    targets: "Planwerte (Soll) – keine Ergebnisse",
    uncertain: "Offene Punkte und fehlende Nachweise",
    do_not_report: "Nicht berichtsfähige Angaben",
    questions: "Rückfragen an den Projektpartner",
    method: "Methodik und Nachweise",
  },
  en: {
    summary: "Executive summary",
    verified: "Verified results (actual)",
    targets: "Targets (plan) — not results",
    uncertain: "Open points and missing evidence",
    do_not_report: "Figures excluded from reporting",
    questions: "Questions for the project partner",
    method: "Method and evidence",
  },
};

export const statusL = (s: ClaimStatus, lang: Lang) => STATUS_L[lang][s];
export const indicatorL = (i: Indicator, lang: Lang) => INDICATOR_L[lang][i];
export const evidenceTypeL = (t: EvidenceType, lang: Lang) => EVIDENCE_TYPE_L[lang][t];
export const unitL = (u: Claim["unit"], lang: Lang) => UNIT_L[lang][u];

/** Vue localisée d'un claim : textes produits par le code et le modèle dans la langue demandée. */
export function claimView(c: Claim, lang: Lang) {
  const de = lang === "de" ? c.de : undefined;
  return {
    label: (lang === "de" ? de?.headline : c.headline) ?? INDICATOR_L[lang][c.indicator],
    reasons: de?.reasons ?? c.reasons,
    summary: de?.summary ?? c.summary,
    risk: de?.risk ?? c.risk,
    advice: de?.advice ?? c.advice,
    textSource: de?.textSource ?? c.textSource,
    quote: de?.quote ?? c.quote,
    checks: c.checks.map((k) => (lang === "de" && k.de ? { ...k, name: k.de.name, detail: k.de.detail } : k)),
    confusions: c.confusions.map((x) => (lang === "de" && x.noteDe ? { ...x, note: x.noteDe } : x)),
    unit: UNIT_L[lang][c.unit],
    status: STATUS_L[lang][c.status],
  };
}
