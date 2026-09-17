import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "./config";
import { computeImpact, markOutdated, redraftSelection, staleClaimIds } from "./engine/impact";
import { EVIDENCE_TYPE_LABEL } from "./engine/lexicon";
import { computePlanActual, rowsNeedingJustification } from "./engine/plan-actual";
import { runAnalysis } from "./graph/analyze";
import { resumeReport, startReport, type ReviewDecision } from "./graph/report";
import type { StepEvent } from "./harness/trace";
import { lt, type LText } from "./i18n/core";
import { AppError } from "./i18n/server";
import { chatJSON } from "./llm";
import { evidenceFromInitial, normalizeType, rulesFromInitial, SIMULATIONS } from "./sample";
import { getWorkspace, resetWorkspace, updateWorkspace } from "./store";
import type { Analysis, Evidence, EvidenceType, HistoryEntry, Impact, Report, Role } from "./types";

const TYPES = Object.keys(EVIDENCE_TYPE_LABEL) as EvidenceType[];
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const sameName = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

function uniqueEvidenceId(existing: Evidence[], base: string) {
  const clean = base.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) || "DOC";
  let id = clean;
  let n = 2;
  while (existing.some((e) => e.id === id)) id = `${clean}-${n++}`;
  return id;
}

/** Le modèle SUGGÈRE un type ; la personne confirme (le type fixe le plafond de preuve). */
export async function suggestType(text: string): Promise<EvidenceType> {
  try {
    const r = await chatJSON({
      model: config.readerModel,
      maxTokens: 2000,
      user: `Classify this programme evidence record (it may be in English, German or French). Choose ONE key: ${TYPES.join(", ")}.
plan = targets or planned capacity; attendance = sign-in or attendance sheet; assessment = completion/test results;
voice-note-transcript = spoken note; coordinator-note = note from staff; partner-report = narrative field update; reviewer-note = an instruction for reporting.
RECORD: """${text.slice(0, 2000)}"""
Return JSON: {"type": "..."}`,
      schema: z.object({ type: z.string() }),
    });
    return TYPES.includes(r.data.type as EvidenceType) ? (r.data.type as EvidenceType) : "other";
  } catch {
    return "other";
  }
}

export async function addFiles(files: { name: string; text: string }[], origin: Evidence["origin"]) {
  const now = new Date().toISOString();
  const added: string[] = [];
  const pending: { id: string; text: string }[] = [];
  await updateWorkspace((w) => {
    for (const f of files) {
      const trimmed = f.text.trim();
      if (!trimmed) continue;
      // format initial.json (evidence + reviewer_notes + rules)
      if (f.name.endsWith(".json")) {
        try {
          const data = JSON.parse(trimmed);
          if (Array.isArray(data.evidence)) {
            for (const ev of evidenceFromInitial(data, origin, now, f.name)) {
              const id = w.evidence.some((e) => e.id === ev.id) ? uniqueEvidenceId(w.evidence, ev.id) : ev.id;
              w.evidence.push({ ...ev, id });
              added.push(id);
            }
            for (const r of rulesFromInitial(data, now)) if (!w.rules.some((x) => x.text === r.text)) w.rules.push({ ...r, id: uniqueRuleId(w.rules.map((x) => x.id), r.id) });
            if (data.programme?.reporting_period && w.evidence.length === added.length) w.period = data.programme.reporting_period;
            continue;
          }
          if (Array.isArray(data)) {
            for (const item of data) {
              if (typeof item?.text !== "string") continue;
              const id = uniqueEvidenceId(w.evidence, item.id ?? f.name);
              w.evidence.push({ id, type: normalizeType(String(item.type ?? "other")), text: item.text, origin, fileName: f.name, addedAt: now, typeConfirmed: !!item.type });
              added.push(id);
            }
            continue;
          }
        } catch {
          /* texte brut */
        }
      }
      const id = uniqueEvidenceId(w.evidence, f.name.replace(/\.[a-z0-9]+$/i, ""));
      w.evidence.push({ id, type: "other", text: trimmed.slice(0, 20000), origin, fileName: f.name, addedAt: now, typeConfirmed: false });
      added.push(id);
      pending.push({ id, text: trimmed });
    }
  });
  // suggestion de type en dehors du verrou (appel modèle)
  const suggestions = await Promise.all(pending.map(async (p) => ({ id: p.id, type: await suggestType(p.text) })));
  await updateWorkspace((w) => {
    for (const s of suggestions) {
      const ev = w.evidence.find((e) => e.id === s.id);
      if (ev && !ev.typeConfirmed) {
        ev.suggestedType = s.type;
        ev.type = s.type;
      }
    }
  });
  return added;
}

function uniqueRuleId(ids: string[], base: string) {
  let id = base;
  let n = 2;
  while (ids.includes(id)) id = `${base}-${n++}`;
  return id;
}

type AnalyzeEmit = (e: StepEvent | { type: "analysis"; analysis: Analysis } | { type: "impact"; impact: Impact | null }) => void;

/**
 * Événement SIMULÉ : ajoute la pièce étiquetée puis relance l'analyse tout de suite
 * (pas de second clic) ; l'impact sur les claims sélectionnés et les rapports est calculé par le code.
 */
export async function simulate(key: string, emit?: AnalyzeEmit) {
  const sim = SIMULATIONS[key];
  if (!sim) throw new AppError("unknownSim");
  if (key === "french_pack" || key === "german_pack") {
    resetWorkspace(key === "french_pack" ? "french" : "german");
    const analysis = await analyze(emit);
    return { analysis, impact: null };
  }
  const now = new Date().toISOString();
  await updateWorkspace((w) => {
    for (const ev of sim.evidence) if (!w.evidence.some((e) => e.id === ev.id)) w.evidence.push({ ...ev, addedAt: now });
    w.feedbackLog.push({
      at: now, who: "Facilitator (simulated)", kind: "feedback",
      note: `Simulated event: ${sim.label} — ${sim.description}`,
      noteDe: `Simuliertes Ereignis: ${sim.labelDe} – ${sim.descriptionDe}`,
    });
  });
  const analysis = await analyze(emit, { trigger: lt(`${sim.labelDe} (SIMULIERT)`, `${sim.label} (SIMULATED)`), simulated: true });
  return { analysis, impact: getWorkspace().impacts?.find((i) => i.analysisId === analysis.id) ?? null };
}

export async function analyze(emit?: AnalyzeEmit, opts: { trigger?: LText; simulated?: boolean } = {}) {
  const w = getWorkspace();
  const lastIds = new Set(w.analyses.find((a) => a.status === "done")?.evidenceIds ?? []);
  const newEvidenceIds = w.evidence.filter((e) => !lastIds.has(e.id)).map((e) => e.id);
  let impact: Impact | null = null;
  const analysis: Analysis = {
    id: newId("an"), kind: "analysis", createdAt: new Date().toISOString(), status: "running",
    evidenceIds: w.evidence.map((e) => e.id), claimIds: [], spans: [], latencyMs: 0,
    stats: { mentions: 0, questions: 0, readings: 0, fallbacks: 0 },
  };
  const t0 = Date.now();
  try {
    const out = await runAnalysis({ analysisId: analysis.id, evidence: w.evidence, period: w.period, registry: w.claimKeys, emit });
    Object.assign(analysis, { status: "done", claimIds: out.claims.map((c) => c.id), spans: out.spans, stats: out.stats, latencyMs: Date.now() - t0 });
    await updateWorkspace((ws) => {
      const before = ws.claims;
      ws.claims = out.claims;
      ws.claimKeys = { ...ws.claimKeys, ...out.registry };
      ws.analyses.unshift(analysis);
      const now = new Date().toISOString();
      const ids = newEvidenceIds.join(", ");
      const trigger = opts.trigger ?? (newEvidenceIds.length ? lt(`Neuer Beleg: ${ids}`, `New evidence: ${ids}`) : lt("Neue Auswertung", "Re-analysis"));
      const simulated = opts.simulated ?? newEvidenceIds.some((id) => ws.evidence.find((e) => e.id === id)?.origin === "simulated");
      impact = computeImpact({ before, after: out.claims, ws, trigger, simulated, analysisId: analysis.id, newEvidenceIds, now });
      if (impact) {
        ws.impacts = [impact, ...(ws.impacts ?? [])].slice(0, 20);
        markOutdated(ws, impact);
        const selected = impact.changes.filter((c) => c.inBag || c.reportIds.length);
        if (selected.length || impact.outdatedReportIds.length) {
          const list = selected.map((c) => c.id).join(", ");
          ws.feedbackLog.push({
            at: now, who: "Evidence Desk (code)", kind: "change",
            note: `${trigger.en}: ${selected.length} selected claim(s) outdated (${list || "none"}); ${impact.outdatedReportIds.length} report(s) now need a new approval.`,
            noteDe: `${trigger.de}: ${selected.length} ausgewählte Zahlenaussage(n) überholt (${list || "keine"}); ${impact.outdatedReportIds.length} Bericht(e) brauchen eine neue Freigabe.`,
          });
        }
      }
    });
  } catch (e) {
    Object.assign(analysis, { status: "error", error: String(e).slice(0, 400), latencyMs: Date.now() - t0 });
    await updateWorkspace((ws) => void ws.analyses.unshift(analysis));
  }
  emit?.({ type: "analysis", analysis });
  emit?.({ type: "impact", impact });
  return analysis;
}

const entry = (who: string, role: HistoryEntry["role"], action: HistoryEntry["action"], note?: LText): HistoryEntry => ({
  at: new Date().toISOString(), who, role, action, note: note?.en, noteDe: note?.de,
});

export async function generateReport(
  emit?: (e: StepEvent | { type: "report"; report: Report }) => void,
  opts: { supersedes?: string; preparedBy?: string } = {},
) {
  const w = getWorkspace();
  const prev = opts.supersedes ? w.reports.find((r) => r.id === opts.supersedes) : undefined;
  const claims = w.bag.map((id) => w.claims.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  if (!claims.length) throw new AppError("emptyBag");
  const preparedBy = opts.preparedBy?.trim() || "—";
  const planActual = computePlanActual(claims);
  // Begründung reprise si la ligne Soll-Ist n'a pas changé depuis la version précédente
  const carried: NonNullable<Report["deviationNotes"]> = {};
  for (const row of planActual.rows.filter((x) => x.needsJustification)) {
    const old = prev?.planActual?.rows.find((x) => x.key === row.key);
    const note = prev?.deviationNotes?.[row.key];
    if (old && note?.text && old.soll?.value === row.soll?.value && old.ist?.value === row.ist?.value)
      carried[row.key] = { ...note, fromVersion: note.fromVersion ?? prev!.version ?? 1 };
  }
  const report: Report = {
    id: newId("rp"), createdAt: new Date().toISOString(), title: "", period: w.period,
    claimIds: claims.map((c) => c.id), claimsSnapshot: claims, sections: [], status: "writing", textSource: "model",
    writerAttempts: 0, checkProblems: [], spans: [], rulesApplied: w.rules.filter((r) => r.active).map((r) => r.id),
    supersedes: prev?.id, version: prev ? (prev.version ?? 1) + 1 : 1,
    planActual,
    preparedBy,
    deviationNotes: carried,
    history: [
      entry(preparedBy, "officer", "created", prev ? lt(`Neue Fassung von v${prev.version ?? 1}`, `New version of v${prev.version ?? 1}`) : undefined),
      ...Object.keys(carried).map((k) =>
        entry(preparedBy, "officer", "justified", lt(`Begründung aus v${carried[k].fromVersion} übernommen (Soll-Ist unverändert)`, `Justification carried over from v${carried[k].fromVersion} (plan vs actual unchanged)`)),
      ),
    ],
  };
  await updateWorkspace((ws) => {
    ws.reports.unshift(report);
    const old = prev && ws.reports.find((r) => r.id === prev.id);
    if (old) {
      old.supersededBy = report.id;
      (old.history ??= []).push(entry(preparedBy, "officer", "superseded", lt(`Ersetzt durch v${report.version}`, `Replaced by v${report.version}`)));
    }
  });
  try {
    const out = await startReport({ reportId: report.id, claims, rules: w.rules, period: w.period, caseName: w.caseName }, emit);
    const langs = [out.texts.de, out.texts.en];
    Object.assign(report, {
      texts: out.texts,
      // champs historiques : version allemande (langue du client)
      title: out.texts.de.title,
      sections: out.texts.de.sections,
      status: out.waitingForReview ? "draft" : "error",
      textSource: langs.some((t) => t.textSource === "template") ? "template" : "model",
      writerAttempts: Math.max(...langs.map((t) => t.attempts)),
      checkProblems: [...new Set(langs.flatMap((t) => t.problems))],
      spans: out.spans,
    });
    const tpl = (["de", "en"] as const).filter((l) => out.texts[l].textSource === "template");
    report.history!.push(
      tpl.length
        ? entry("Evidence Desk", "system", "template", lt(`Sichere Vorlage verwendet (${tpl.join(", ").toUpperCase()})`, `Safe template used (${tpl.join(", ").toUpperCase()})`))
        : entry("Evidence Desk", "system", "written", lt("Entwurf DE + EN geschrieben und maschinell geprüft", "Draft written in DE + EN and machine-checked")),
    );
  } catch (e) {
    Object.assign(report, { status: "error", error: String(e).slice(0, 400) });
  }
  await updateWorkspace((ws) => {
    const i = ws.reports.findIndex((r) => r.id === report.id);
    ws.reports[i] = report;
  });
  emit?.({ type: "report", report });
  return report;
}

/** Empreinte du contenu approuvé : toute modification ultérieure la rendrait différente. */
export function fingerprintOf(r: Report) {
  const payload = JSON.stringify({
    claims: r.claimsSnapshot.map((c) => [c.id, c.status, c.value, c.indicator, c.evidenceId]),
    texts: r.texts ?? r.sections,
    notes: r.deviationNotes ?? {},
    version: r.version ?? 1,
  });
  const h = createHash("sha256").update(payload).digest("hex").slice(0, 12).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

export async function reviewReport(reportId: string, d: ReviewDecision & { role: Role }) {
  const w = getWorkspace();
  const report = w.reports.find((r) => r.id === reportId);
  if (!report) throw new AppError("reportNotFound", {}, 404);
  if (report.status === "outdated") throw new AppError("outdated");
  if (report.status !== "draft") throw new AppError("notWaiting");
  if (report.supersededBy) throw new AppError("superseded");
  if (!report.texts) throw new AppError("legacy");
  // Vier-Augen-Prinzip : rôle et personne différents de l'auteur
  if (d.role !== "reviewer") throw new AppError("roleReviewer", {}, 403);
  if (sameName(d.reviewer, report.preparedBy)) {
    await updateWorkspace((ws) => {
      const r = ws.reports.find((x) => x.id === reportId);
      r?.history?.push(entry(d.reviewer, "reviewer", "blocked", lt("Selbstfreigabe verhindert (Vier-Augen-Prinzip)", "Self-approval prevented (four-eyes principle)")));
    });
    throw new AppError("fourEyes", { name: d.reviewer }, 403);
  }
  const last = w.analyses.find((a) => a.status === "done");
  const unread = w.evidence.filter((e) => !last?.evidenceIds.includes(e.id)).map((e) => e.id);
  if (unread.length) throw new AppError("unread", { ids: unread.join(", ") });
  const stale = staleClaimIds(report.claimsSnapshot, w.claims);
  if (stale.length) {
    await updateWorkspace((ws) => {
      const r = ws.reports.find((x) => x.id === reportId)!;
      r.outdated = {
        at: new Date().toISOString(), previousStatus: r.status, changedClaimIds: stale, impactId: ws.impacts?.[0]?.id ?? "",
        trigger: "Checked at approval time", triggerDe: "Bei der Freigabe geprüft",
      };
      r.status = "outdated";
    });
    throw new AppError("staleAtReview", { ids: stale.join(", ") });
  }
  if (d.decision === "approve") {
    const missing = rowsNeedingJustification(report.planActual).filter((row) => !report.deviationNotes?.[row.key]?.text.trim());
    if (missing.length) {
      throw new AppError("justification", {
        rows: lt(
          missing.map((m) => ({ participants: "Teilnehmende", completion: "Abschluss", passed: "Prüfung bestanden", sessions: "Sitzungen" })[m.key]).join(", "),
          missing.map((m) => ({ participants: "participants", completion: "completion", passed: "passed", sessions: "sessions" })[m.key]).join(", "),
        ),
      });
    }
  }
  const out = await resumeReport(reportId, d);
  const now = new Date().toISOString();
  await updateWorkspace((ws) => {
    const r = ws.reports.find((x) => x.id === reportId)!;
    r.status = d.decision === "approve" ? "approved" : "changes_requested";
    const fingerprint = d.decision === "approve" ? fingerprintOf(r) : undefined;
    r.review = { decision: d.decision, reviewer: d.reviewer, note: d.note, at: now, role: d.role, fingerprint };
    r.spans = out.spans;
    (r.history ??= []).push(
      d.decision === "approve"
        ? entry(d.reviewer, "reviewer", "approved", lt(`Prüfvermerk ${fingerprint}`, `Approval stamp ${fingerprint}`))
        : entry(d.reviewer, "reviewer", "changes", lt(d.note, d.note)),
    );
    if (d.decision === "changes" && d.note.trim()) {
      // mémoire sélective : la note devient une règle courte, verrouillée, désactivable
      ws.rules.push({
        id: uniqueRuleId(ws.rules.map((x) => x.id), `REV-${ws.rules.filter((x) => x.source === "reviewer-feedback").length + 1}`),
        text: d.note.trim().slice(0, 300), source: "reviewer-feedback", sourceRef: reportId, createdAt: now, active: true,
        enforcedBy: "Injected into the next report draft as a locked instruction (style only, never a fact).",
        enforcedByDe: "Wird dem nächsten Entwurf als feste Anweisung mitgegeben (nur Stil, nie Fakten).",
      });
    }
    ws.feedbackLog.push({
      at: now, who: d.reviewer, kind: d.decision === "approve" ? "feedback" : "change",
      note: d.decision === "approve" ? `Approved report v${r.version ?? 1} (four-eyes principle, stamp ${fingerprint}).` : `Requested changes: ${d.note}`,
      noteDe: d.decision === "approve" ? `Bericht v${r.version ?? 1} freigegeben (Vier-Augen-Prinzip, Prüfvermerk ${fingerprint}).` : `Überarbeitung angefordert: ${d.note}`,
    });
  });
}

/** Begründung d'un écart Soll-Ist, saisie par la personne qui a rédigé (Projektreferent:in). */
export async function setDeviationNote(reportId: string, a: { rowKey: string; text: string; by: string; role: Role }) {
  if (a.role !== "officer") throw new AppError("roleOfficer", {}, 403);
  return updateWorkspace((w) => {
    const r = w.reports.find((x) => x.id === reportId);
    if (!r) throw new AppError("reportNotFound", {}, 404);
    if (r.status !== "draft" || r.supersededBy) throw new AppError("notDraft");
    const now = new Date().toISOString();
    r.deviationNotes ??= {};
    if (a.text.trim()) r.deviationNotes[a.rowKey] = { text: a.text.trim().slice(0, 600), by: a.by, at: now };
    else delete r.deviationNotes[a.rowKey];
    (r.history ??= []).push(entry(a.by, "officer", "justified", lt(a.text.trim() || "(entfernt)", a.text.trim() || "(removed)")));
    return r.deviationNotes;
  });
}

/** Refaire un rapport : le bag reçoit les claims encore valides et leurs remplaçants. */
export async function prepareRedraft(reportId: string) {
  return updateWorkspace((w) => {
    const r = w.reports.find((x) => x.id === reportId);
    if (!r) throw new AppError("reportNotFound", {}, 404);
    const ids = redraftSelection(w, r);
    if (!ids.length) throw new AppError("noValidClaims");
    const now = new Date().toISOString();
    w.bag = ids;
    for (const id of ids) {
      const c = w.claims.find((x) => x.id === id)!;
      w.bagMeta[id] = { addedAt: now, statusAtAdd: c.status };
    }
    return ids;
  });
}
