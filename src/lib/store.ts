import fs from "node:fs";
import path from "node:path";
import { CLIENT_NAME, frenchPackState, germanPackState, startState } from "./sample";
import type { Workspace } from "./types";

const DIR = path.join(process.cwd(), "data", "runtime");
const FILE = path.join(DIR, "workspace.json");
const CACHE = path.join(DIR, "cache.json");

type Cache = Record<string, unknown>;

const g = globalThis as unknown as { __c08Lock?: Promise<unknown> };

function readFile<T>(file: string, fallback: () => T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback();
  }
}

function writeFile(file: string, data: unknown) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

export function getWorkspace(): Workspace {
  if (!fs.existsSync(FILE)) writeFile(FILE, startState());
  const w = readFile(FILE, startState);
  if (!w.client) {
    // migration : espace créé avant l'attribution du client
    w.client = CLIENT_NAME;
    w.caseName = w.caseName.replace(/^C08 · /, `${CLIENT_NAME} · `).replace(/^Site C · /, `${CLIENT_NAME} · Site C `);
  }
  return w;
}

/** Mise à jour sérialisée (évite deux écritures concurrentes). */
export function updateWorkspace<T>(fn: (w: Workspace) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const w = getWorkspace();
    const out = await fn(w);
    w.updatedAt = new Date().toISOString();
    writeFile(FILE, w);
    return out;
  };
  const next = (g.__c08Lock ?? Promise.resolve()).then(run, run);
  g.__c08Lock = next.catch(() => undefined);
  return next;
}

export function resetWorkspace(pack: "c08" | "french" | "german" = "c08") {
  writeFile(FILE, pack === "french" ? frenchPackState() : pack === "german" ? germanPackState() : startState());
  try {
    fs.rmSync(path.join(DIR, "checkpoints.json"), { force: true });
  } catch {}
}

/** Cache des lectures du modèle : une pièce déjà lue n'est pas relue (rapide quand on ajoute des fichiers). */
export function cacheGet<T>(key: string): T | undefined {
  return readFile<Cache>(CACHE, () => ({}))[key] as T | undefined;
}
export function cacheSet(key: string, value: unknown) {
  const c = readFile<Cache>(CACHE, () => ({}));
  c[key] = value;
  writeFile(CACHE, c);
}
