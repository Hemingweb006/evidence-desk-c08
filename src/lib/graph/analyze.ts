import { createHash } from "node:crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { config } from "../config";
import { allowedNumbers, applyTemplates, claimLabel, decide, derive, findConfusions, fmt, incoherenceScore, numbersIn, reconcile, type DraftClaim, type QuestionItem } from "../engine/decide";
import { EVIDENCE_TYPE_LABEL, INDICATOR_LABEL, TAXONOMY } from "../engine/lexicon";
import { findMentions } from "../engine/mentions";
import { useTool } from "../harness/permissions";
import { pool, track, traced, type StepEvent } from "../harness/trace";
import { chatJSON } from "../llm";
import { cacheGet, cacheSet } from "../store";
import type { Claim, Evidence, Indicator, Mention, Modality, Reading, Span } from "../types";

const INDICATORS = Object.keys(TAXONOMY) as Indicator[];
const MODALITIES: Modality[] = ["measured", "planned", "retracted", "hedged", "reported", "absent", "unclear"];

interface CachedReading {
  question: string;
  options: Indicator[];
  source: "model" | "template";
  readings: Reading[];
}

const State = Annotation.Root({
  analysisId: Annotation<string>,
  period: Annotation<string>,
  evidence: Annotation<Evidence[]>,
  registry: Annotation<Record<string, string>>,
  useCache: Annotation<boolean>,
  items: Annotation<(QuestionItem & { key: string; readings?: Reading[] })[]>,
  mentionsByEvidence: Annotation<Record<string, Mention[]>>,
  claims: Annotation<Claim[]>,
  stats: Annotation<{ mentions: number; questions: number; readings: number; fallbacks: number }>,
  spans: Annotation<Span[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type S = typeof State.State;

const readingKey = (ev: Evidence, m: Mention) =>
  "r:" + createHash("sha1").update(`${ev.id}|${ev.type}|${ev.text}|${m.mid}|${config.readerModel}`).digest("hex").slice(0, 16);

// ─── 1. Préparation (code) ──────────────────────────────────────────────────
const preprocess = traced<S, Partial<S>>("preprocess", "Pre-processing", async (s, ctx) => {
  useTool("preprocess", "evidence.read", ctx.tools);
  const facts = s.evidence.filter((e) => e.type !== "reviewer-note");
  const items: S["items"] = [];
  const mentionsByEvidence: Record<string, Mention[]> = {};
  let cached = 0;
  for (const ev of facts) {
    const ms = findMentions(ev);
    mentionsByEvidence[ev.id] = ms;
    for (const m of ms) {
      const key = readingKey(ev, m);
      const hit = s.useCache ? cacheGet<CachedReading>(key) : undefined;
      if (hit) cached++;
      items.push({
        key, evidence: ev, mention: m,
        question: hit?.question ?? "", options: hit?.options ?? [], source: hit?.source ?? "template", readings: hit?.readings,
      });
    }
  }
  const unconfirmed = s.evidence.filter((e) => !e.typeConfirmed).length;
  ctx.checks.push({ name: "Numbers found by rules, not by a model", pass: true, detail: `${items.length} mention(s)` });
  ctx.checks.push({ name: "Evidence types confirmed by a person", pass: unconfirmed === 0, detail: unconfirmed ? `${unconfirmed} using the suggested type` : undefined });
  ctx.summary = `${facts.length} evidence record(s), ${items.length} number mention(s), ${cached} already read (cache)`;
  return { items, mentionsByEvidence, stats: { mentions: items.length, questions: 0, readings: 0, fallbacks: 0 } };
});

// ─── 2. M1 : questions fermées ──────────────────────────────────────────────
const QSchema = z.object({
  questions: z.array(z.object({ mid: z.string(), question: z.string(), options: z.array(z.string()) })).default([]),
});
const LEADING = /\b(trained|completed|attended|passed|enrolled|formée?s?|terminé|présents?|inscrits?|réussi)\b/i;

const question = traced<S, Partial<S>>("question", "M1 · Closed questions", async (s, ctx) => {
  const todo = s.items.filter((i) => !i.readings);
  if (!todo.length) {
    ctx.summary = "Nothing new to ask (all mentions cached)";
    return {};
  }
  useTool("question", "llm.questions", ctx.tools);
  const listing = todo
    .map((i) => `- ${i.mention.mid} = "${i.mention.surface}" in [${i.evidence.id}] (${i.evidence.type}): ${i.evidence.text}`)
    .join("\n");
  let byMid = new Map<string, { question: string; options: string[] }>();
  try {
    const r = await chatJSON({
      model: config.questionModel,
      maxTokens: 8000,
      user: `You prepare CLOSED questions for a careful reader. Never answer them.
For each number mention, write ONE neutral question asking what the number refers to. Quote the number exactly.
Do not presuppose an interpretation: do not use the words trained, completed, attended, passed or enrolled in the question.
Pick 3 to 7 candidate options ONLY from these keys: ${INDICATORS.join(", ")}. Always include "unclear".
MENTIONS:
${listing}
Return JSON: {"questions": [{"mid": "...", "question": "...", "options": ["..."]}]}`,
      schema: QSchema,
    });
    track(ctx, r.usage);
    byMid = new Map(r.data.questions.map((q) => [q.mid, q]));
  } catch (e) {
    ctx.checks.push({ name: "Question model answered", pass: false, detail: String(e).slice(0, 120) });
  }
  let fallbacks = 0;
  const items = s.items.map((i) => {
    if (i.readings) return i;
    const q = byMid.get(i.mention.mid);
    let options = (q?.options ?? []).filter((o): o is Indicator => INDICATORS.includes(o as Indicator));
    let text = q?.question ?? "";
    const invalid = !q || options.length < 2 || LEADING.test(text) || !text.toLowerCase().includes(i.mention.surface.toLowerCase());
    if (invalid) {
      fallbacks++;
      text = `In this record, what does “${i.mention.surface}” refer to?`;
      options = INDICATORS.filter((o) => o !== "other");
    }
    for (const must of ["unclear", "other"] as Indicator[]) if (!options.includes(must)) options.push(must);
    return { ...i, question: text, options, source: invalid ? ("template" as const) : ("model" as const) };
  });
  ctx.checks.push({ name: "Questions are closed and neutral", pass: true, detail: `${fallbacks} replaced by a neutral template` });
  ctx.summary = `${todo.length} closed question(s); ${fallbacks} leading/invalid question(s) replaced by code`;
  return { items, stats: { ...s.stats, questions: todo.length, fallbacks } };
});

// ─── 3. M2 : lectures indépendantes, options mélangées ─────────────────────
const RSchema = z.object({
  letter: z.string().default(""),
  modality: z.string().default("unclear"),
  sentence: z.string().default(""),
});
const LETTERS = "ABCDEFGHIJKLMN";

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let x = seed * 9301 + 49297;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const read = traced<S, Partial<S>>("read", "M2 · Independent readings", async (s, ctx) => {
  const todo = s.items.filter((i) => !i.readings);
  if (!todo.length) {
    ctx.summary = "All readings reused from cache";
    return {};
  }
  useTool("read", "evidence.read", ctx.tools);
  useTool("read", "llm.read", ctx.tools);
  let calls = 0;
  const done = await pool(todo, 6, async (item) => {
    const readings: Reading[] = await Promise.all(
      Array.from({ length: config.readingsPerQuestion }, async (_, k): Promise<Reading> => {
        const opts = shuffle(item.options, k + 1);
        const menu = opts.map((o, i) => `${LETTERS[i]}) ${o}: ${TAXONOMY[o]}`).join("\n");
        try {
          const r = await chatJSON({
            model: config.readerModel,
            maxTokens: 800,
            user: `RECORD [${item.evidence.id}] (type: ${item.evidence.type}):
"${item.evidence.text}"

QUESTION: ${item.question}
OPTIONS:
${menu}

Read the WHOLE record, including corrections that come later. If you are not sure, choose unclear.
modality is one of: measured (a counted fact), planned (a target), retracted (the speaker corrects or withdraws it), hedged (uncertain wording), reported (someone says it, not a record), absent.
sentence: copy the complete sentence of the record text that contains the number, word for word.
Return JSON only: {"letter": "A", "modality": "...", "sentence": "..."}`,
            schema: RSchema,
          });
          calls++;
          track(ctx, r.usage);
          const idx = LETTERS.indexOf(r.data.letter.trim().charAt(0).toUpperCase());
          return {
            choice: idx >= 0 && idx < opts.length ? opts[idx] : "unclear",
            modality: (MODALITIES.includes(r.data.modality as Modality) ? r.data.modality : "unclear") as Modality,
            sentence: r.data.sentence,
          };
        } catch {
          return { choice: "unclear", modality: "unclear", sentence: "" }; // échec = « pas clair », jamais une supposition
        }
      }),
    );
    cacheSet(item.key, { question: item.question, options: item.options, source: item.source, readings } satisfies CachedReading);
    return { key: item.key, readings };
  });
  const byKey = new Map(done.map((d) => [d.key, d.readings]));
  const items = s.items.map((i) => (i.readings ? i : { ...i, readings: byKey.get(i.key) }));
  const disagreements = done.filter((d) => new Set(d.readings.map((r) => r.choice)).size > 1).length;
  ctx.checks.push({ name: "Each number read twice, options shuffled", pass: true, detail: `${disagreements} disagreement(s) → uncertain` });
  ctx.summary = `${calls} reading(s) for ${todo.length} number(s); ${disagreements} disagreement(s)`;
  return { items, stats: { ...s.stats, readings: calls } };
});

// ─── 4. Le code décide ──────────────────────────────────────────────────────
const decideNode = traced<S, Partial<S>>("decide", "Code decides the status", async (s, ctx) => {
  const period = s.period;
  let drafts: (DraftClaim & { key: string })[] = s.items.map((i) => ({ ...decide(i, i.readings ?? [], period), key: `m:${i.evidence.id}:${i.mention.mid}` }));
  const mentionsMap = new Map(Object.entries(s.mentionsByEvidence));
  drafts = reconcile(drafts, s.evidence, period, mentionsMap).map((d) => ({
    ...d,
    key: (d as { key?: string }).key ?? `absence:${d.evidenceId}:${d.indicator}`,
  }));
  const registry = { ...s.registry };
  const nextId = () => `C${Object.keys(registry).length + 1}`;
  const idFor = (key: string) => (registry[key] ??= nextId());
  let claims: Claim[] = drafts.map((d) => {
    const { key, ...rest } = d;
    return { ...rest, id: idFor(key), analysisId: s.analysisId, confusions: [], incoherence: 0, summary: "", risk: "", advice: "", textSource: "template" as const };
  });
  const derived = derive(claims, period, s.analysisId, () => "PENDING").map((c) => ({
    ...c,
    id: idFor(`derived:${c.evidenceId}:${c.indicator}`),
  }));
  claims = [...claims, ...derived];
  for (const c of claims) {
    c.confusions = findConfusions(c, claims);
    c.incoherence = incoherenceScore(c);
    applyTemplates(c);
  }
  const count = (st: string) => claims.filter((c) => c.status === st).length;
  ctx.checks.push({ name: "Status can only go down", pass: true });
  ctx.checks.push({ name: "Totals computed by code", pass: true, detail: derived.length ? derived.map((d) => `${d.id} = ${d.derivation}`).join("; ") : "no derivation needed" });
  ctx.summary = `${claims.length} claim(s): ${count("VERIFIED")} verified, ${count("TARGET")} target, ${count("UNCERTAIN")} uncertain, ${count("UNKNOWN")} unknown, ${count("MISLEADING")} misleading`;
  return { claims, registry };
});

// ─── 5. Textes des cartes (modèle), vérifiés par le code — allemand et anglais ─
const Card = z.object({ summary: z.string().default(""), risk: z.string().default(""), advice: z.string().default("") });
const ESchema = z.object({
  cards: z.array(z.object({ id: z.string(), en: Card.optional(), de: Card.optional() })).default([]),
});
type CardText = z.infer<typeof Card>;
const ESCALATION: Record<"en" | "de", RegExp> = {
  en: /\b(is|are|was|were|has been|have been)\s+(confirmed|verified|proven|achieved)\b/i,
  de: /\b(ist|sind|wurde|wurden|wird|werden)\s+(bestätigt|belegt|nachgewiesen|erreicht|verifiziert)\b/i,
};
const NEGATION: Record<"en" | "de", RegExp> = {
  en: /\b(not|never|cannot be|can't be)\s+\w*\s*/gi,
  de: /(?<![\p{L}])(nicht|nie|noch nicht|kein\w*)\s+[\p{L}]*\s*/giu,
};

/** null = texte accepté ; sinon la raison du rejet (tracée). */
function cardProblem(c: Claim, all: Claim[], lang: "en" | "de", t: CardText | undefined): string | null {
  if (!t || !t.summary || !t.risk || !t.advice) return "missing text";
  const text = `${t.summary} ${t.risk} ${t.advice}`;
  const allowed = allowedNumbers([c], all);
  const bad = numbersIn(text).filter((n) => !allowed.has(n));
  if (bad.length) return `number ${bad.join(", ")} not in the claim`;
  if (c.status !== "VERIFIED" && ESCALATION[lang].test(text.replace(NEGATION[lang], ""))) return "claims certainty";
  return null;
}

const explain = traced<S, Partial<S>>("explain", "Plain-language card texts", async (s, ctx) => {
  const sig = (c: Claim) =>
    "e2:" + createHash("sha1").update(JSON.stringify([c.id, c.status, c.value, c.indicator, c.evidenceId, c.reasons, c.confusions.map((x) => x.note)])).digest("hex").slice(0, 16);
  type Pair = { en?: CardText; de?: CardText };
  const cached = (c: Claim) => (s.useCache ? cacheGet<Pair>(sig(c)) : undefined);
  const todo = s.claims.filter((c) => !cached(c));
  let fromModel = new Map<string, Pair>();
  if (todo.length) {
    useTool("explain", "llm.explain", ctx.tools);
    const table = todo
      .map((c) => `${c.id} | status=${c.status} | value=${fmt(c.value)} ${c.unit} | meaning=${claimLabel(c)} | period=${c.period} | evidence=${c.evidenceId} (${EVIDENCE_TYPE_LABEL[c.evidenceType]}) | quote="${c.quote}" | reasons=${c.reasons.join("; ") || "none"} | confusions=${c.confusions.map((x) => x.note).join(" ") || "none"}`)
      .join("\n");
    try {
      const r = await chatJSON({
        model: config.readerModel,
        maxTokens: 12000,
        user: `Write short texts for claim cards used by a programme reporting officer at a German development foundation, and by the person who approves the report.
Write each card twice: "en" in plain English, and "de" in clear, formal German (Sachbericht style, no "du").
German glossary (use these words): VERIFIED = "belegt"; TARGET = "Planwert (Soll)"; UNCERTAIN = "Rückfrage nötig"; UNKNOWN = "noch kein Nachweis"; MISLEADING = "nicht berichtsfähig";
evidence record = "Beleg"; project partner = "Projektpartner"; participants = "Teilnehmende"; reporting period = "Berichtszeitraum". Keep evidence ids (e.g. SHEET-A) and the period text unchanged.
Rules: never change a status; never add a number that is not in the row; for any status other than VERIFIED, never say the figure is confirmed, verified or belegt.
Be neutral towards the partner: say a figure is "not reportable", never that someone lied.
summary: one sentence saying what the figure is and what it is not.
risk: one sentence on what could go wrong if it is reported carelessly.
advice: one sentence on how to report it (or not).
ROWS:
${table}
Return JSON: {"cards": [{"id": "C1", "en": {"summary": "...", "risk": "...", "advice": "..."}, "de": {"summary": "...", "risk": "...", "advice": "..."}}]}`,
        schema: ESchema,
      });
      track(ctx, r.usage);
      fromModel = new Map(r.data.cards.map((c) => [c.id, { en: c.en, de: c.de }]));
    } catch (e) {
      ctx.checks.push({ name: "Card writer answered", pass: false, detail: String(e).slice(0, 100) });
    }
  }
  const rejected: string[] = [];
  const claims = s.claims.map((c) => {
    const hit = cached(c);
    const cand = hit ?? fromModel.get(c.id);
    if (!cand) return c;
    const next: Claim = { ...c, de: c.de ? { ...c.de } : undefined };
    const keep: Pair = {};
    const pEn = cardProblem(c, s.claims, "en", cand.en);
    if (!pEn && cand.en) {
      Object.assign(next, cand.en, { textSource: "model" as const });
      keep.en = cand.en;
    } else if (!hit || cand.en) rejected.push(`${c.id} EN: ${pEn}`);
    const pDe = cardProblem(c, s.claims, "de", cand.de);
    if (next.de && !pDe && cand.de) {
      Object.assign(next.de, cand.de, { textSource: "model" as const });
      keep.de = cand.de;
    } else if (!hit || cand.de) rejected.push(`${c.id} DE: ${pDe}`);
    if (!hit && (keep.en || keep.de)) cacheSet(sig(c), keep);
    return next; // un texte rejeté garde son modèle déterministe
  });
  ctx.checks.push({ name: "Card texts add no number and no certainty (EN + DE)", pass: true, detail: rejected.length ? `rejected → template: ${rejected.join("; ")}` : "none rejected" });
  ctx.summary = `${claims.filter((c) => c.textSource === "model").length} EN and ${claims.filter((c) => c.de?.textSource === "model").length} DE card text(s) from the model; the rest from templates`;
  return { claims };
});

export function buildAnalysisGraph() {
  return new StateGraph(State)
    .addNode("preprocess", preprocess)
    .addNode("question", question)
    .addNode("read", read)
    .addNode("decide", decideNode)
    .addNode("explain", explain)
    .addEdge(START, "preprocess")
    .addEdge("preprocess", "question")
    .addEdge("question", "read")
    .addEdge("read", "decide")
    .addEdge("decide", "explain")
    .addEdge("explain", END)
    .compile();
}

const g = globalThis as unknown as { __c08Analysis?: ReturnType<typeof buildAnalysisGraph> };

export async function runAnalysis(args: {
  analysisId: string;
  evidence: Evidence[];
  period: string;
  registry: Record<string, string>;
  emit?: (e: StepEvent) => void;
  useCache?: boolean;
}) {
  g.__c08Analysis ??= buildAnalysisGraph();
  const stream = await g.__c08Analysis.stream(
    { analysisId: args.analysisId, evidence: args.evidence, period: args.period, registry: args.registry, useCache: args.useCache ?? true, items: [], claims: [], mentionsByEvidence: {} },
    { streamMode: ["custom", "values"] },
  );
  let last: S | null = null;
  for await (const [mode, data] of stream as AsyncIterable<[string, unknown]>) {
    if (mode === "custom") args.emit?.(data as StepEvent);
    if (mode === "values") last = data as S;
  }
  if (!last) throw new Error("Analysis produced no state");
  return { claims: last.claims, registry: last.registry, spans: last.spans, stats: last.stats };
}
