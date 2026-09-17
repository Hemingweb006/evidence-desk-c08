export type EvidenceType =
  | "plan"
  | "attendance"
  | "assessment"
  | "voice-note-transcript"
  | "coordinator-note"
  | "partner-report"
  | "reviewer-note"
  | "other";

export interface Evidence {
  id: string;
  type: EvidenceType;
  text: string;
  origin: "supplied" | "uploaded" | "pasted" | "simulated";
  fileName?: string;
  addedAt: string;
  suggestedType?: EvidenceType;
  typeConfirmed: boolean;
}

export type Indicator =
  | "planned"
  | "enrolled"
  | "attended"
  | "attended_day"
  | "attended_overlap"
  | "completed"
  | "passed"
  | "reached_incl_others"
  | "sessions"
  | "other"
  | "unclear";

export type Modality = "measured" | "planned" | "retracted" | "hedged" | "reported" | "absent" | "unclear";

export type ClaimStatus = "VERIFIED" | "TARGET" | "UNCERTAIN" | "UNKNOWN" | "MISLEADING";

export interface Mention {
  mid: string;
  surface: string;
  value: number;
  pos: number;
  approx: boolean;
}

export interface Reading {
  choice: Indicator;
  modality: Modality;
  sentence: string;
}

export interface Check {
  name: string; // anglais : identifiant stable
  pass: boolean;
  detail?: string;
  de?: { name: string; detail?: string };
}

export interface Confusion {
  claimId: string;
  kind: "same_number_other_meaning" | "same_indicator_other_value" | "derived_from";
  note: string;
  noteDe?: string;
}

export interface Claim {
  id: string;
  analysisId: string;
  value: number | null;
  surface: string;
  unit: "people" | "sessions";
  indicator: Indicator;
  headline?: string; // libellé imposé par le code (ex. « énoncé corrigé »)
  period: string;
  evidenceId: string;
  evidenceType: EvidenceType;
  quote: string; // phrase complète de la pièce (tirée par le code)
  status: ClaimStatus;
  reasons: string[];
  checks: Check[];
  question: string;
  readings: Reading[];
  derivation?: string;
  confusions: Confusion[];
  incoherence: number; // 0–100, calculé par le code
  summary: string;
  risk: string;
  advice: string;
  textSource: "model" | "template";
  /** Textes allemands (le code et le modèle écrivent les deux langues). */
  de?: {
    headline?: string;
    reasons: string[];
    quote?: string;
    summary: string;
    risk: string;
    advice: string;
    textSource: "model" | "template";
  };
}

export interface Span {
  node: string;
  label: string;
  startedAt: string;
  ms: number;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  tools: { name: string; allowed: boolean }[];
  checks: Check[];
  summary: string;
  attempt?: number;
}

export interface Analysis {
  id: string;
  kind: "analysis";
  createdAt: string;
  status: "running" | "done" | "error";
  evidenceIds: string[];
  claimIds: string[];
  spans: Span[];
  latencyMs: number;
  error?: string;
  stats: { mentions: number; questions: number; readings: number; fallbacks: number };
}

export interface LockedRule {
  id: string;
  text: string;
  source: "supplied-reviewer-note" | "reviewer-feedback";
  sourceRef: string;
  createdAt: string;
  active: boolean;
  enforcedBy: string; // où la règle est appliquée
  textDe?: string; // traduction affichée (le texte fourni reste la référence)
  enforcedByDe?: string;
}

export interface ReportSection {
  key: "summary" | "verified" | "targets" | "uncertain" | "do_not_report" | "questions" | "method";
  title: string;
  paragraphs: { text: string; claimIds: string[] }[];
}

export type Role = "officer" | "reviewer";

export interface ReportText {
  title: string;
  sections: ReportSection[];
  textSource: "model" | "template";
  attempts: number;
  problems: string[];
}

/** Soll-Ist-Vergleich et Wirkungskette : calculés par le code à partir des claims choisis. */
export interface PlanActualRow {
  key: "participants" | "completion" | "passed" | "sessions";
  soll?: { value: number; claimId: string; evidenceId: string };
  ist?: { value: number; claimId: string; evidenceId: string; derived: boolean };
  open: { claimId: string; status: ClaimStatus; value: number | null; evidenceId: string }[];
  excluded: { claimId: string; value: number | null; evidenceId: string; equalsSoll: boolean }[];
  deviation?: { abs: number; pct: number };
  needsJustification: boolean;
}
export interface ChainLevel {
  key: "plan" | "activities" | "output" | "outcome" | "impact";
  state: "evidenced" | "open" | "none" | "not_claimable";
  claimIds: string[];
}
export interface PlanActual {
  rows: PlanActualRow[];
  chain: ChainLevel[];
  threshold: number;
}

export interface HistoryEntry {
  at: string;
  who: string;
  role: Role | "system";
  action: "created" | "written" | "template" | "changes" | "justified" | "approved" | "outdated" | "superseded" | "blocked";
  note?: string;
  noteDe?: string;
}

export interface Report {
  id: string;
  createdAt: string;
  title: string;
  period: string;
  claimIds: string[];
  claimsSnapshot: Claim[];
  sections: ReportSection[];
  status: "writing" | "draft" | "approved" | "changes_requested" | "outdated" | "error";
  textSource: "model" | "template";
  writerAttempts: number;
  checkProblems: string[];
  spans: Span[];
  rulesApplied: string[];
  review?: { decision: "approve" | "changes"; reviewer: string; note: string; at: string; role?: Role; fingerprint?: string };
  error?: string;
  /** Posé par le code quand une nouvelle pièce change un claim utilisé par ce rapport. */
  outdated?: { at: string; previousStatus: Report["status"]; changedClaimIds: string[]; impactId: string; trigger: string; triggerDe?: string };
  supersedes?: string; // rapport remplacé par cette nouvelle version
  supersededBy?: string;
  version?: number;
  lang?: "de" | "en";
  texts?: Partial<Record<"de" | "en", ReportText>>;
  planActual?: PlanActual;
  preparedBy?: string;
  deviationNotes?: Record<string, { text: string; by: string; at: string; fromVersion?: number }>;
  history?: HistoryEntry[];
}

export interface ClaimSnapshotLite {
  status: ClaimStatus;
  value: number | null;
  label: string;
  labelDe?: string;
  evidenceId: string;
}

export interface ClaimChange {
  id: string;
  kind: "removed" | "changed";
  before: ClaimSnapshotLite;
  after?: ClaimSnapshotLite;
  replacedBy: string[]; // nouveaux claims qui couvrent le même indicateur
  inBag: boolean;
  reportIds: string[];
}

/** Impact d'une nouvelle pièce sur les claims déjà sélectionnés (calculé par le code). */
export interface Impact {
  id: string;
  at: string;
  trigger: string;
  triggerDe?: string;
  simulated: boolean;
  analysisId: string;
  newEvidenceIds: string[];
  newClaimIds: string[];
  changes: ClaimChange[];
  outdatedReportIds: string[];
}

export interface Workspace {
  caseName: string;
  period: string;
  evidence: Evidence[];
  claims: Claim[];
  bag: string[];
  analyses: Analysis[];
  reports: Report[];
  rules: LockedRule[];
  feedbackLog: { at: string; who: string; kind: "pain" | "feedback" | "change"; note: string; noteDe?: string }[];
  claimKeys: Record<string, string>; // clé stable -> identifiant affiché (C1, C2…)
  bagMeta: Record<string, { addedAt: string; statusAtAdd: ClaimStatus }>;
  impacts?: Impact[]; // le plus récent en premier
  client?: string;
  updatedAt: string;
}
