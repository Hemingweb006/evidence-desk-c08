import { EVIDENCE_TYPE_L, INDICATOR_L, STATUS_L } from "../i18n/terms";
import type { ClaimStatus, EvidenceType, Indicator } from "../types";

/** Liste FERMÉE des sens possibles d'un chiffre. Le modèle choisit, il n'invente pas. */
export const TAXONOMY: Record<Indicator, string> = {
  planned: "a planned capacity, target or goal",
  enrolled: "people registered or enrolled",
  attended: "unique people who attended at least one session",
  attended_day: "people present on one specific day or session",
  attended_overlap: "people who attended several days/sessions (overlap between days)",
  completed: "people who completed the programme",
  passed: "people who passed an assessment or test",
  reached_incl_others: "a count that includes non-participants (e.g. parents, staff)",
  sessions: "a number of sessions, days or weeks",
  other: "something else",
  unclear: "unclear / cannot tell from the text",
};

/** Libellés anglais (identifiants stables pour les prompts) ; l'interface utilise i18n/terms. */
export const INDICATOR_LABEL: Record<Indicator, string> = INDICATOR_L.en;

/** Plafond de preuve : ce qu'un type de pièce peut établir, au mieux. */
export const CEILING: Record<EvidenceType, Indicator[]> = {
  plan: ["planned", "sessions"],
  attendance: ["attended", "attended_day", "attended_overlap", "enrolled", "sessions"],
  assessment: ["completed", "passed", "sessions"],
  "voice-note-transcript": [], // ouï-dire : ne prouve jamais seul
  "coordinator-note": [],
  "partner-report": [],
  "reviewer-note": [],
  other: [],
};

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = EVIDENCE_TYPE_L.en;

export const EVIDENCE_TIER: Record<EvidenceType, "record" | "plan" | "hearsay" | "rule"> = {
  plan: "plan",
  attendance: "record",
  assessment: "record",
  "voice-note-transcript": "hearsay",
  "coordinator-note": "hearsay",
  "partner-report": "hearsay",
  "reviewer-note": "rule",
  other: "hearsay",
};

export const STATUS_RANK: Record<ClaimStatus, number> = {
  VERIFIED: 4,
  TARGET: 4,
  UNCERTAIN: 2,
  UNKNOWN: 1,
  MISLEADING: 0,
};

export const STATUS_LABEL: Record<ClaimStatus, string> = STATUS_L.en;

// Marqueurs linguistiques détectés par RÈGLE (EN / FR / DE)
export const RETRACT = [
  "i mean", "actually", "sorry", "correction", "scratch that",
  "je veux dire", "enfin", "en fait", "pardon", "ou plutôt",
  "ich meine", "ich meinte", "genauer gesagt", "eigentlich", "korrigiere", "verzeihung",
];
export const HEDGE = [
  "i think", "i believe", "not sure", "approximately", "around", "roughly", "maybe", "probably", "need to check",
  "je crois", "environ", "à peu près", "il me semble", "peut-être", "à vérifier",
  "vermutlich", "ungefähr", "ich glaube", "etwa", "circa", "ca.", "rund", "schätzungsweise", "knapp", "nicht sicher", "zu prüfen",
];
export const ABSENCE = [
  "no completion", "has not been", "not been submitted", "not yet", "no assessment", "not available",
  "aucune évaluation", "pas encore", "non transmis", "noch nicht", "kein", "liegt nicht vor", "nicht eingereicht",
];

export const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50,
  deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
  dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
  zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50,
};
export const APPROX_WORDS: Record<string, number> = {
  dozen: 12, dutzend: 12, douzaine: 12, quinzaine: 15, vingtaine: 20, trentaine: 30, quarantaine: 40, cinquantaine: 50, centaine: 100,
};

export const DAY_NOUNS = new Set([
  "jours", "jour", "days", "day", "sessions", "session", "séances", "séance", "tage", "tagen", "tag", "weeks", "week", "semaines", "semaine",
  "sitzungen", "sitzung", "termine", "termin", "wochen", "woche", "einheiten",
]);
export const PEOPLE_NOUNS = new Set([
  "people", "participants", "participant", "persons", "personnes", "bénéficiaires", "beneficiaries",
  "signatures", "inscrits", "learners", "trainees", "personen", "teilnehmende", "teilnehmer", "teilnehmerinnen",
  "menschen", "leute", "begünstigte", "unterschriften",
]);
