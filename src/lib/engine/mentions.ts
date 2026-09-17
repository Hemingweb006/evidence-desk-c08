import type { Evidence, Mention } from "../types";
import { ABSENCE, APPROX_WORDS, DAY_NOUNS, HEDGE, NUMBER_WORDS, PEOPLE_NOUNS, RETRACT } from "./lexicon";

/** Le CODE trouve chaque chiffre (écrit en chiffres ou en lettres). Le modèle ne peut pas en inventer. */
export function findMentions(ev: Evidence): Mention[] {
  const t = ev.text;
  const out: Omit<Mention, "mid">[] = [];
  for (const m of t.matchAll(/(?<![\w.-])\d+(?:[.,]\d+)?(?![\w-])/g)) {
    const v = Number(m[0].replace(",", "."));
    if (v === 0 || v === 1) continue; // « au moins une séance », « semaine 1 »
    out.push({ surface: m[0], value: v, pos: m.index!, approx: false });
  }
  for (const m of t.matchAll(/[\p{L}]+/gu)) {
    const w = m[0].toLowerCase();
    if (w in NUMBER_WORDS) out.push({ surface: m[0], value: NUMBER_WORDS[w], pos: m.index!, approx: false });
    else if (w in APPROX_WORDS) out.push({ surface: m[0], value: APPROX_WORDS[w], pos: m.index!, approx: true });
  }
  out.sort((a, b) => a.pos - b.pos);
  return out.map((x, i) => ({ ...x, mid: `${ev.id}#${i + 1}` }));
}

/** Proposition (clause) qui contient la position donnée. */
export function clauseOf(text: string, pos: number): string {
  const bounds = [...text.matchAll(/[.;!?](?=\s|$)/g)].map((m) => m.index!);
  const start = Math.max(0, ...bounds.filter((b) => b < pos).map((b) => b + 1));
  const endCandidates = bounds.filter((b) => b >= pos);
  const end = endCandidates.length ? endCandidates[0] + 1 : text.length;
  return text.slice(start, end).trim();
}

/** Phrase complète (pour l'affichage de la preuve). */
export function sentenceOf(text: string, pos: number): string {
  const bounds = [...text.matchAll(/[.!?](?=\s|$)/g)].map((m) => m.index!);
  const start = Math.max(0, ...bounds.filter((b) => b < pos).map((b) => b + 1));
  const endCandidates = bounds.filter((b) => b >= pos);
  const end = endCandidates.length ? endCandidates[0] + 1 : text.length;
  return text.slice(start, end).trim();
}

export interface Cue {
  kind: "retracted" | "hedged";
  cue: string;
}

/** Recherche d'un marqueur en mot entier (« rund » ne doit pas matcher « Grund »). */
const cueRe = new Map<string, RegExp>();
function findCue(text: string, cue: string, from = 0): number {
  let re = cueRe.get(cue);
  if (!re) {
    const esc = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, "gu");
    cueRe.set(cue, re);
  }
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? m.index : -1;
}

export function codeCues(ev: Evidence, m: Mention): Cue[] {
  const lower = ev.text.toLowerCase();
  const cues: Cue[] = [];
  for (const c of RETRACT) {
    // une correction APRÈS le chiffre le rétracte
    if (findCue(lower, c, m.pos + 1) > m.pos) cues.push({ kind: "retracted", cue: c });
  }
  const clause = clauseOf(ev.text, m.pos).toLowerCase();
  for (const c of HEDGE) if (findCue(clause, c) >= 0) cues.push({ kind: "hedged", cue: c });
  if (m.approx) cues.push({ kind: "hedged", cue: "approximation" });
  return cues;
}

/** Nom qui suit le chiffre : « deux jours » ≠ « deux personnes ». */
export function unitNoun(ev: Evidence, m: Mention): { noun: string; kind: "days" | "people" | "unknown" } {
  const after = ev.text.slice(m.pos + m.surface.length, m.pos + m.surface.length + 30).toLowerCase();
  const nm = after.match(/^\s*(?:de\s+|d['’]\s*|more\s+|unique\s+|new\s+|additional\s+|weitere\s+|neue\s+|zusätzliche\s+)?([\p{L}]+)/u);
  const noun = nm?.[1] ?? "";
  if (DAY_NOUNS.has(noun)) return { noun, kind: "days" };
  if (PEOPLE_NOUNS.has(noun)) return { noun, kind: "people" };
  return { noun, kind: "unknown" };
}

export function hasAbsence(text: string): string | null {
  const lower = text.toLowerCase();
  return ABSENCE.find((a) => lower.includes(a)) ?? null;
}

export const normalizeForQuote = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
