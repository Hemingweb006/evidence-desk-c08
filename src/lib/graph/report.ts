import { Annotation, Command, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import { z } from "zod";
import { config } from "../config";
import { allowedNumbers, claimLabel, fmt, numbersIn } from "../engine/decide";
import { EVIDENCE_TYPE_LABEL } from "../engine/lexicon";
import { checkpointer } from "../harness/checkpointer";
import { useTool } from "../harness/permissions";
import { track, traced, type Ctx, type StepEvent } from "../harness/trace";
import { LANGS, type Lang } from "../i18n/core";
import { EVIDENCE_TYPE_L, INDICATOR_L, SECTION_TITLE_L, STATUS_L, UNIT_L } from "../i18n/terms";
import { chatJSON } from "../llm";
import type { Claim, ClaimStatus, LockedRule, ReportSection, ReportText, Role, Span } from "../types";

export const SECTION_META: Record<ReportSection["key"], { title: string; allowed: ClaimStatus[] }> = {
  summary: { title: SECTION_TITLE_L.en.summary, allowed: ["VERIFIED", "TARGET", "UNCERTAIN", "UNKNOWN"] },
  verified: { title: SECTION_TITLE_L.en.verified, allowed: ["VERIFIED"] },
  targets: { title: SECTION_TITLE_L.en.targets, allowed: ["TARGET"] },
  uncertain: { title: SECTION_TITLE_L.en.uncertain, allowed: ["UNCERTAIN", "UNKNOWN"] },
  do_not_report: { title: SECTION_TITLE_L.en.do_not_report, allowed: ["MISLEADING"] },
  questions: { title: SECTION_TITLE_L.en.questions, allowed: ["UNCERTAIN", "UNKNOWN", "MISLEADING"] },
  method: { title: SECTION_TITLE_L.en.method, allowed: [] },
};
const HOME: Record<ClaimStatus, ReportSection["key"]> = {
  VERIFIED: "verified", TARGET: "targets", UNCERTAIN: "uncertain", UNKNOWN: "uncertain", MISLEADING: "do_not_report",
};
const WRITTEN_KEYS = ["summary", "verified", "targets", "uncertain", "do_not_report", "questions"] as const;

export interface ReviewDecision {
  decision: "approve" | "changes";
  reviewer: string;
  note: string;
  role?: Role;
}

/** Problème détecté par le vérificateur (structuré, rendu dans chaque langue). */
export type Problem =
  | { kind: "empty" }
  | { kind: "writer_failed" }
  | { kind: "unknown"; section: ReportSection["key"]; claimId: string }
  | { kind: "section"; section: ReportSection["key"]; claimId: string; status: ClaimStatus }
  | { kind: "number"; section: ReportSection["key"]; number: number; excerpt: string }
  | { kind: "missing"; claimId: string; status: ClaimStatus; section: ReportSection["key"] };

export function problemText(p: Problem, lang: Lang): string {
  const T = SECTION_TITLE_L[lang];
  const st = (s: ClaimStatus) => (lang === "en" ? s : STATUS_L.de[s]);
  switch (p.kind) {
    case "empty":
      return lang === "de" ? "Der Bericht ist leer" : "The report is empty";
    case "writer_failed":
      return lang === "de" ? "Der Schreiber hat keinen gültigen Bericht geliefert" : "The writer did not return a valid report";
    case "unknown":
      return lang === "de" ? `${T[p.section]}: unbekannte Aussage ${p.claimId}` : `${T[p.section]}: unknown claim ${p.claimId}`;
    case "section":
      return lang === "de"
        ? `${T[p.section]}: ${p.claimId} ist „${st(p.status)}“ und darf hier nicht zitiert werden`
        : `${T[p.section]}: ${p.claimId} is ${p.status} and cannot be cited here`;
    case "number":
      return lang === "de"
        ? `${T[p.section]}: Die Zahl ${p.number} steht in keiner zitierten Aussage – „${p.excerpt}…“`
        : `${T[p.section]}: the number ${p.number} is not in the cited claim(s) — “${p.excerpt}…”`;
    case "missing":
      return lang === "de"
        ? `${p.claimId} („${st(p.status)}“) fehlt im Abschnitt „${T[p.section]}“`
        : `${p.claimId} (${p.status}) is missing from “${T[p.section]}”`;
  }
}

type LangState = { title: string; sections: ReportSection[]; problems: Problem[]; attempts: number; textSource: "model" | "template" };
const emptyLang = (): LangState => ({ title: "", sections: [], problems: [], attempts: 0, textSource: "model" });

const State = Annotation.Root({
  reportId: Annotation<string>,
  period: Annotation<string>,
  caseName: Annotation<string>,
  claims: Annotation<Claim[]>,
  rules: Annotation<LockedRule[]>,
  texts: Annotation<Record<Lang, LangState>>,
  decision: Annotation<ReviewDecision | null>,
  spans: Annotation<Span[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type S = typeof State.State;

function tableText(claims: Claim[], lang: Lang = "en") {
  const de = lang === "de";
  return claims
    .map((c) => {
      const meaning = de ? c.de?.headline ?? INDICATOR_L.de[c.indicator] : claimLabel(c);
      const evType = de ? EVIDENCE_TYPE_L.de[c.evidenceType] : EVIDENCE_TYPE_LABEL[c.evidenceType];
      const unit = UNIT_L[lang][c.unit];
      const why = (de ? c.de?.reasons : c.reasons)?.join("; ") || (de ? "alle Prüfungen bestanden" : "all checks passed");
      return `${c.id} | STATUS=${c.status} | value=${fmt(c.value)} | unit=${unit} | meaning=${meaning} | period=${c.period} | evidence=${c.evidenceId} (${evType}) | why=${why}${c.derivation ? ` | computed=${c.derivation}` : ""}`;
    })
    .join("\n");
}

export function methodSection(claims: Claim[], period: string, lang: Lang): ReportSection {
  const ev = [...new Set(claims.map((c) => c.evidenceId))];
  const p =
    lang === "de"
      ? [
          `Dieser Entwurf deckt den Berichtszeitraum „${period}“ ab. Er verwendet nur die in der Berichtsmappe ausgewählten Zahlenaussagen aus ${ev.length} Beleg(en): ${ev.join(", ")}.`,
          "Zahlen wurden per Regel gefunden, zweimal unabhängig mit geschlossenen Fragen von einem Modell ausgewertet und vom Code eingestuft: Jede Belegart hat eine Obergrenze (ein Planungsdokument belegt einen Planwert, eine Teilnahmeliste die Teilnahme, nur ein Abschlussnachweis den Abschluss). Korrekturen und unsichere Formulierungen senken den Status; Summen berechnet der Code.",
          "Der Schreiber sah nur die geprüfte Tabelle der Zahlenaussagen. Eine automatische Prüfung stellte sicher, dass jede Zahl zu einer zitierten Aussage gehört und im richtigen Abschnitt steht. Soll-Ist-Vergleich und Wirkungskette berechnet der Code. Der Bericht bleibt ein Entwurf, bis eine zweite Person ihn freigibt (Vier-Augen-Prinzip).",
        ]
      : [
          `This draft covers ${period}. It only uses the claims selected in the report folder, drawn from ${ev.length} evidence record(s): ${ev.join(", ")}.`,
          "Numbers were located by rules, read twice by a model through closed questions, and classified by code: each evidence type has a ceiling (a plan proves a target, an attendance sheet proves attendance, only an assessment proves completion), corrections and hedging lower the status, and totals are computed by code.",
          "The writer only saw the validated claim table. An automatic checker verified that every figure belongs to a cited claim and sits in the right section. The plan-versus-actual table and the results chain are computed by code. This report stays a draft until a second person approves it (four-eyes principle).",
        ];
  return { key: "method", title: SECTION_TITLE_L[lang].method, paragraphs: p.map((text) => ({ text, claimIds: [] })) };
}

// ─── Étapes ────────────────────────────────────────────────────────────────
const assemble = traced<S, Partial<S>>("assemble", "Assemble the claim bag", async (s, ctx) => {
  useTool("assemble", "rules.read", ctx.tools);
  const by = (st: ClaimStatus) => s.claims.filter((c) => c.status === st).length;
  ctx.checks.push({ name: "Only selected claims are used", pass: true, detail: `${s.claims.length} claim(s)` });
  ctx.summary = `${s.claims.length} claim(s): ${by("VERIFIED")} verified, ${by("TARGET")} target, ${by("UNCERTAIN") + by("UNKNOWN")} uncertain/unknown, ${by("MISLEADING")} excluded · ${s.rules.filter((r) => r.active).length} locked rule(s) · languages: ${LANGS.join(", ")}`;
  return { texts: { de: emptyLang(), en: emptyLang() } };
});

const WSchema = z.object({
  title: z.string().default(""),
  sections: z.record(z.string(), z.array(z.object({ text: z.string(), claimIds: z.array(z.string()).default([]) }))).default({}),
});

const LANG_BRIEF: Record<Lang, string> = {
  en: `Write in clear British English for the foundation's reviewer.`,
  de: `Write in formal German, in the style of a German foundation's "Sachbericht" (no "du").
Use this glossary: VERIFIED = "belegt"; TARGET = "Planwert (Soll)"; UNCERTAIN = "Rückfrage nötig"; UNKNOWN = "noch kein Nachweis"; MISLEADING = "nicht berichtsfähig";
participants = "Teilnehmende"; project partner = "Projektpartner"; evidence record = "Beleg"; reporting period = "Berichtszeitraum"; target = "Planwert"; actual = "Ist-Wert".
Keep evidence ids (e.g. SHEET-A) and the period text exactly as given. Write numbers as digits.`,
};

const needsWork = (t: LangState) => t.sections.length === 0 || t.problems.length > 0;

async function writeOne(s: S, lang: Lang, ctx: Ctx): Promise<LangState> {
  const prev = s.texts[lang];
  const rules = s.rules.filter((r) => r.active).map((r) => `- ${r.text}`).join("\n");
  const feedback = prev.problems.length
    ? `\n\nYOUR PREVIOUS VERSION WAS REJECTED BY THE CHECKER:\n${prev.problems.map((p) => `- ${problemText(p, "en")}`).join("\n")}\nFix every point.${
        prev.problems.some((p) => p.kind === "section" && p.section === "summary" && p.status === "MISLEADING")
          ? "\nIn the summary, do not mention the misleading figure at all — no sentence, no number, no claim id. The do_not_report section already covers it."
          : ""
      }`
    : "";
  try {
    const r = await chatJSON({
      model: config.writerModel,
      maxTokens: 16000,
      thinking: config.writerThinking,
      user: `You write a professional DRAFT programme progress report (Sachbericht) for a development foundation.
${LANG_BRIEF[lang]}
You do NOT see the evidence. You may ONLY use this validated claim table. Never change a status. Never add a number that is not in the rows you cite.
Each paragraph lists the claim ids it relies on in "claimIds" (do not write the ids in the text; they are shown as chips). Every paragraph that contains a number must cite the claim(s) that contain that number.
Put each claim in the section that matches its status:
- summary: 2–4 sentences for a busy reviewer: state each VERIFIED result with its value, give TARGET values as targets, and say briefly what is still open (UNCERTAIN, UNKNOWN). Never cite or mention MISLEADING claims here. Do not add explanations that are not in the table.
- verified: VERIFIED claims — state value, unit and period
- targets: TARGET claims — always say they are targets, not results
- uncertain: UNCERTAIN and UNKNOWN claims — say what is missing; never present them as facts
- do_not_report: MISLEADING claims — explain neutrally why the figure must not be reported as a result
- questions: concrete, polite questions for the project partner about UNCERTAIN, UNKNOWN or MISLEADING claims (cite them)
Leave a section as an empty list if no claim belongs there. Every claim must appear at least once in its section.
LOCKED REVIEWER RULES (style and wording, never facts):
${rules || "- none"}
PROGRAMME: ${s.caseName} · PERIOD: ${s.period}
CLAIM TABLE${lang === "de" ? " (labels already in German)" : ""}:
${tableText(s.claims, lang)}
Return JSON: {"title": "...", "sections": {"summary": [{"text": "...", "claimIds": ["C1"]}], "verified": [], "targets": [], "uncertain": [], "do_not_report": [], "questions": []}}${feedback}`,
      schema: WSchema,
    });
    track(ctx, r.usage);
    const sections: ReportSection[] = WRITTEN_KEYS.map((k) => ({
      key: k,
      title: SECTION_TITLE_L[lang][k],
      paragraphs: (r.data.sections[k] ?? []).map((p) => ({
        // les identifiants sont affichés en puces par l'interface : on les retire du texte
        text: p.text.replace(/\s*\((?:C\d+(?:\s*[,;]\s*|\s+(?:and|und)\s+)?)+\)/g, "").replace(/\s+([.,;:])/g, "$1").trim(),
        claimIds: [...new Set(p.claimIds)],
      })),
    }));
    // le statut (Entwurf / freigegeben) est affiché à part : pas de « DRAFT / Entwurf » dans le titre
    const title =
      r.data.title
        .replace(/\(\s*(draft|entwurf)\s*\)/gi, "")
        .replace(/\b(draft|entwurf)\s*[:—–-]?\s+(?=\p{L})/giu, "")
        .replace(/[\s:—–-]*\b(draft|entwurf)\b\s*$/i, "")
        .replace(/\s{2,}/g, " ")
        .trim() || (lang === "de" ? "Sachbericht" : "Programme progress report");
    return { title, sections, problems: [], attempts: prev.attempts + 1, textSource: "model" };
  } catch (e) {
    ctx.checks.push({ name: `Writer answered (${lang})`, pass: false, detail: String(e).slice(0, 120) });
    return { ...prev, sections: [], problems: [{ kind: "writer_failed" }], attempts: prev.attempts + 1 };
  }
}

const write = traced<S, Partial<S>>("write", "M3 · Write the report (DE + EN)", async (s, ctx) => {
  useTool("write", "llm.write_report", ctx.tools);
  const todo = LANGS.filter((l) => needsWork(s.texts[l]) && s.texts[l].attempts < config.maxWriterAttempts);
  const results = await Promise.all(todo.map(async (l) => [l, await writeOne(s, l, ctx)] as const));
  const texts = { ...s.texts };
  for (const [l, t] of results) texts[l] = t;
  ctx.summary = results.map(([l, t]) => `${l.toUpperCase()} attempt ${t.attempts}: ${t.sections.reduce((n, x) => n + x.paragraphs.length, 0)} paragraph(s)`).join(" · ");
  return { texts };
});

export function checkReport(sections: ReportSection[], claims: Claim[]): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(claims.map((c) => [c.id, c]));
  const cited = new Map<string, Set<string>>();
  if (!sections.length) return [{ kind: "empty" }];
  for (const sec of sections) {
    if (sec.key === "method") continue;
    const meta = SECTION_META[sec.key];
    for (const p of sec.paragraphs) {
      for (const id of p.claimIds) {
        const c = byId.get(id);
        if (!c) {
          problems.push({ kind: "unknown", section: sec.key, claimId: id });
          continue;
        }
        if (!meta.allowed.includes(c.status)) problems.push({ kind: "section", section: sec.key, claimId: id, status: c.status });
        cited.set(id, (cited.get(id) ?? new Set()).add(sec.key));
      }
      const citedClaims = p.claimIds.map((i) => byId.get(i)).filter((c): c is Claim => !!c);
      const allowed = allowedNumbers(citedClaims, claims);
      for (const n of numbersIn(p.text)) if (!allowed.has(n)) problems.push({ kind: "number", section: sec.key, number: n, excerpt: p.text.slice(0, 70) });
    }
  }
  for (const c of claims) {
    if (!cited.get(c.id)?.has(HOME[c.status])) problems.push({ kind: "missing", claimId: c.id, status: c.status, section: HOME[c.status] });
  }
  return problems;
}

/** Version texte (évaluations, affichage). */
export const checkReportText = (sections: ReportSection[], claims: Claim[], lang: Lang = "en") => checkReport(sections, claims).map((p) => problemText(p, lang));

const check = traced<S, Partial<S>>("check", "Machine check of the report (DE + EN)", async (s, ctx) => {
  const texts = { ...s.texts };
  for (const l of LANGS) {
    if (texts[l].problems.some((p) => p.kind === "writer_failed")) continue;
    texts[l] = { ...texts[l], problems: checkReport(texts[l].sections, s.claims) };
  }
  const all = LANGS.flatMap((l) => texts[l].problems);
  ctx.checks.push({ name: "Every number belongs to a cited claim", pass: !all.some((p) => p.kind === "number") });
  ctx.checks.push({ name: "Every claim sits in the right section", pass: !all.some((p) => p.kind === "section" || p.kind === "missing") });
  ctx.summary = LANGS.map((l) => {
    const n = texts[l].problems.length;
    return `${l.toUpperCase()}: ${n ? `${n} problem(s) — ${texts[l].attempts < config.maxWriterAttempts ? "sent back to the writer" : "safe template"}` : "passes every check"}`;
  }).join(" · ");
  return { texts };
});

export function templateSections(claims: Claim[], lang: Lang = "en"): ReportSection[] {
  const T = SECTION_TITLE_L[lang];
  const de = lang === "de";
  const label = (c: Claim) => (de ? INDICATOR_L.de[c.indicator] : INDICATOR_L.en[c.indicator].toLowerCase());
  const u = (c: Claim) => UNIT_L[lang][c.unit];
  const line = (c: Claim) => `${fmt(c.value)} ${u(c)} – ${label(c)} (${c.period}).`;
  const reason = (c: Claim) => (de ? c.de?.reasons[0] : c.reasons[0]);
  const pick = (st: ClaimStatus[]) => claims.filter((c) => st.includes(c.status));
  const ver = pick(["VERIFIED"]);
  const open = pick(["UNCERTAIN", "UNKNOWN"]).length > 0;
  const excluded = pick(["MISLEADING"]).length > 0;
  const summaryTail = de
    ? `${open ? "Einige Angaben sind noch offen und bei den Rückfragen an den Projektpartner aufgeführt. " : ""}${excluded ? "Angaben, die die Belege nicht stützen, werden nicht berichtet und unten begründet." : ""}`.trim() || "Alle ausgewählten Angaben sind belegt."
    : `${open ? "Some figures are still open and are listed with the questions for the project partner. " : ""}${excluded ? "Figures that the evidence does not support are excluded and explained below." : ""}`.trim() || "All selected figures are backed by records.";
  return [
    {
      key: "summary", title: T.summary,
      paragraphs: [
        ...(ver.length
          ? [{
              text: de
                ? `Belegt für den Berichtszeitraum „${ver[0].period}“: ${ver.map((c) => `${fmt(c.value)} ${u(c)} (${label(c)})`).join("; ")}.`
                : `Verified for ${ver[0].period}: ${ver.map((c) => `${fmt(c.value)} ${u(c)} (${label(c)})`).join("; ")}.`,
              claimIds: ver.map((c) => c.id),
            }]
          : []),
        { text: summaryTail, claimIds: [] },
      ],
    },
    { key: "verified", title: T.verified, paragraphs: ver.map((c) => ({ text: line(c), claimIds: [c.id] })) },
    { key: "targets", title: T.targets, paragraphs: pick(["TARGET"]).map((c) => ({ text: `${de ? "Planwert, kein Ergebnis" : "Target, not a result"}: ${line(c)}`, claimIds: [c.id] })) },
    {
      key: "uncertain", title: T.uncertain,
      paragraphs: pick(["UNCERTAIN", "UNKNOWN"]).map((c) => ({
        text:
          c.value === null
            ? `${de ? INDICATOR_L.de[c.indicator] : INDICATOR_L.en[c.indicator]}: ${de ? "noch nicht belegt" : "not yet evidenced"}. ${reason(c) ?? ""}`.trim()
            : `${line(c)} ${de ? "Nicht bestätigt" : "Not confirmed"}: ${reason(c) ?? (de ? "Beleg reicht nicht aus" : "insufficient evidence")}.`,
        claimIds: [c.id],
      })),
    },
    {
      key: "do_not_report", title: T.do_not_report,
      paragraphs: pick(["MISLEADING"]).map((c) => ({
        text: de
          ? `„${c.surface}“ (${c.evidenceId}) wird nicht als Ergebnis berichtet: ${reason(c) ?? "nicht berichtsfähig"}.`
          : `“${c.surface}” (${c.evidenceId}) is not reported as a result: ${reason(c) ?? "not reportable"}.`,
        claimIds: [c.id],
      })),
    },
    {
      key: "questions", title: T.questions,
      paragraphs: Object.values(
        pick(["UNCERTAIN", "UNKNOWN", "MISLEADING"]).reduce<Record<string, { text: string; claimIds: string[] }>>((acc, c) => {
          const text =
            c.value === null
              ? de
                ? `Können Sie uns den Nachweis zu „${INDICATOR_L.de[c.indicator]}“ zusenden?`
                : `Can you send the record that establishes “${INDICATOR_L.en[c.indicator].toLowerCase()}”?`
              : de
                ? `Können Sie die in ${c.evidenceId} genannten Zahlen mit einem datierten Nachweis bestätigen?`
                : `Can you confirm, with a dated record, the figures reported in ${c.evidenceId}?`;
          (acc[text] ??= { text, claimIds: [] }).claimIds.push(c.id);
          return acc;
        }, {}),
      ),
    },
  ];
}

const template = traced<S, Partial<S>>("template", "Safe template fallback", async (s, ctx) => {
  const texts = { ...s.texts };
  const used: Lang[] = [];
  for (const l of LANGS) {
    if (!texts[l].problems.length) continue;
    used.push(l);
    texts[l] = {
      ...texts[l],
      sections: templateSections(s.claims, l),
      textSource: "template",
      problems: texts[l].problems, // gardés pour la trace ; le modèle déterministe les remplace
      title: l === "de" ? `${s.caseName} – Sachbericht` : `${s.caseName} — progress report`,
    };
  }
  ctx.summary = `The writer failed the checks twice (${used.join(", ").toUpperCase()}): deterministic template used for that language`;
  return { texts };
});

const review = traced<S, Partial<S>>("review", "Human review (checkpoint)", async (s, ctx) => {
  useTool("review", "review.request", ctx.tools);
  const decision = interrupt<{ reportId: string }, ReviewDecision>({ reportId: s.reportId });
  ctx.summary = `${decision.decision === "approve" ? "Approved" : "Changes requested"} by ${decision.reviewer}`;
  return { decision };
});

const finalize = traced<S, Partial<S>>("finalize", "Finalize", async (s, ctx) => {
  useTool("finalize", "report.write", ctx.tools);
  if (s.decision?.decision === "changes" && s.decision.note) {
    useTool("finalize", "rules.write", ctx.tools);
    ctx.summary = "Reviewer note stored as a locked rule for the next draft";
  } else ctx.summary = "Report approved (four-eyes principle)";
  return {};
});

export function buildReportGraph() {
  return new StateGraph(State)
    .addNode("assemble", assemble)
    .addNode("write", write)
    .addNode("check", check)
    .addNode("template", template)
    .addNode("review", review)
    .addNode("finalize", finalize)
    .addEdge(START, "assemble")
    .addEdge("assemble", "write")
    .addEdge("write", "check")
    .addConditionalEdges(
      "check",
      (s: S) => {
        const failing = LANGS.filter((l) => s.texts[l].problems.length > 0);
        if (!failing.length) return "review";
        return failing.some((l) => s.texts[l].attempts < config.maxWriterAttempts) ? "write" : "template";
      },
      ["review", "write", "template"],
    )
    .addEdge("template", "review")
    .addEdge("review", "finalize")
    .addEdge("finalize", END)
    .compile({ checkpointer: checkpointer() });
}

const g = globalThis as unknown as { __c08Report2?: ReturnType<typeof buildReportGraph> };
const graph = () => (g.__c08Report2 ??= buildReportGraph());

export interface ReportRunResult {
  texts: Record<Lang, ReportText>;
  spans: Span[];
  waitingForReview: boolean;
  decision: ReviewDecision | null;
}

async function drive(input: unknown, threadId: string, emit?: (e: StepEvent) => void): Promise<ReportRunResult> {
  const cfg = { configurable: { thread_id: threadId }, streamMode: ["custom", "updates"] as ("custom" | "updates")[] };
  const stream = await graph().stream(input as Parameters<ReturnType<typeof graph>["stream"]>[0], cfg);
  for await (const [mode, data] of stream as AsyncIterable<[string, unknown]>) if (mode === "custom") emit?.(data as StepEvent);
  const snap = await graph().getState({ configurable: { thread_id: threadId } });
  const v = snap.values as S;
  const waiting = snap.tasks.some((t) => (t.interrupts ?? []).length > 0);
  const texts = {} as Record<Lang, ReportText>;
  for (const l of LANGS) {
    const t = v.texts?.[l] ?? emptyLang();
    texts[l] = {
      title: t.title,
      sections: t.sections.length ? [...t.sections.filter((x) => x.key !== "method"), methodSection(v.claims, v.period, l)] : [],
      textSource: t.textSource,
      attempts: t.attempts,
      problems: t.problems.map((p) => problemText(p, l)),
    };
  }
  return { texts, spans: v.spans ?? [], waitingForReview: waiting, decision: v.decision ?? null };
}

export function startReport(args: { reportId: string; claims: Claim[]; rules: LockedRule[]; period: string; caseName: string }, emit?: (e: StepEvent) => void) {
  return drive({ ...args, texts: { de: emptyLang(), en: emptyLang() }, decision: null }, args.reportId, emit);
}

export function resumeReport(reportId: string, decision: ReviewDecision) {
  return drive(new Command({ resume: decision }), reportId);
}
