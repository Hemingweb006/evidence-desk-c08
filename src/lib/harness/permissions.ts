/**
 * Permissions des outils (principe Mia : « tool boundaries »).
 * Chaque étape a une liste blanche. Un appel hors liste est refusé ET tracé.
 * Aucune étape n'a le droit d'écrire dans les pièces ; seul l'humain approuve un rapport.
 */
export type ToolName =
  | "evidence.read"
  | "llm.questions"
  | "llm.read"
  | "llm.explain"
  | "llm.write_report"
  | "claims.write"
  | "report.write"
  | "rules.read"
  | "rules.write"
  | "review.request";

export const TOOL_POLICY: Record<string, ToolName[]> = {
  preprocess: ["evidence.read", "rules.read"],
  question: ["llm.questions"],
  read: ["evidence.read", "llm.read"],
  decide: [], // code pur : aucun modèle, aucun outil
  explain: ["llm.explain"],
  store: ["claims.write"],
  assemble: ["rules.read"],
  write: ["llm.write_report"], // le rédacteur ne voit PAS les pièces, seulement le tableau validé
  check: [],
  template: [],
  review: ["review.request"],
  finalize: ["report.write", "rules.write"],
};

export interface ToolLog {
  name: string;
  allowed: boolean;
}

export class ToolPermissionError extends Error {}

export function useTool(node: string, tool: ToolName, log: ToolLog[]) {
  const allowed = (TOOL_POLICY[node] ?? []).includes(tool);
  log.push({ name: tool, allowed });
  if (!allowed) throw new ToolPermissionError(`Tool “${tool}” is not allowed in step “${node}”`);
}
