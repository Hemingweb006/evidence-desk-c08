"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, fmtDateL, isLang, type Lang } from "@/lib/i18n/core";
import { UI, type UIDict } from "@/lib/i18n/ui";
import type { Role, Workspace } from "@/lib/types";

export type WorkspaceView = Workspace & {
  simulations: { key: string; label: string; description: string; labelDe: string; descriptionDe: string; added: boolean }[];
  models: { question: string; reader: string; writer: string };
  apiKey: boolean;
};

export interface Identity {
  role: Role;
  names: Record<Role, string>;
}

const DEFAULT_IDENTITY: Record<Lang, Identity> = {
  de: { role: "officer", names: { officer: "Referent:in (Demo)", reviewer: "Prüfer:in (Demo)" } },
  en: { role: "officer", names: { officer: "Officer (demo)", reviewer: "Reviewer (demo)" } },
};

interface Ctx {
  ws: WorkspaceView | null;
  refresh: () => Promise<void>;
  bagOpen: boolean;
  setBagOpen: (v: boolean) => void;
  toggleBag: (claimId: string, inBag: boolean) => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: UIDict;
  fmtDate: (iso: string) => string;
  identity: Identity;
  setIdentity: (i: Identity) => void;
  me: string;
}

const WorkspaceContext = createContext<Ctx | null>(null);

// langue courante, envoyée au serveur pour des messages d'erreur localisés
let currentLang: Lang | null = null;
function headerLang(): Lang {
  if (currentLang) return currentLang;
  if (typeof window === "undefined") return DEFAULT_LANG;
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  const stored = readStore<Lang>("ed.lang");
  return isLang(fromUrl) ? fromUrl : isLang(stored) ? stored : DEFAULT_LANG;
}

function readStore<T>(key: string): T | null {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeStore(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* stockage indisponible : on continue en mémoire */
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ws, setWs] = useState<WorkspaceView | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [identity, setIdentityState] = useState<Identity>(DEFAULT_IDENTITY[DEFAULT_LANG]);

  useEffect(() => {
    // ?lang=en dans l'URL (lien pour le jury) > préférence enregistrée > allemand
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    const stored = readStore<Lang>("ed.lang");
    const l = isLang(fromUrl) ? fromUrl : isLang(stored) ? stored : DEFAULT_LANG;
    setLangState(l);
    currentLang = l;
    const id = readStore<Identity>("ed.identity");
    setIdentityState(id?.names?.officer && id?.names?.reviewer ? id : DEFAULT_IDENTITY[l]);
  }, []);

  useEffect(() => {
    currentLang = lang;
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    currentLang = l;
    writeStore("ed.lang", l);
    setIdentityState((cur) => {
      // les noms de démo suivent la langue tant que la personne ne les a pas changés
      const isDefault = (["officer", "reviewer"] as Role[]).every((r) => cur.names[r] === DEFAULT_IDENTITY.de.names[r] || cur.names[r] === DEFAULT_IDENTITY.en.names[r]);
      return isDefault ? { ...cur, names: DEFAULT_IDENTITY[l].names } : cur;
    });
  }, []);

  const setIdentity = useCallback((i: Identity) => {
    setIdentityState(i);
    writeStore("ed.identity", i);
  }, []);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/workspace", { cache: "no-store" });
    if (r.ok) setWs(await r.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleBag = useCallback(
    async (claimId: string, inBag: boolean) => {
      // mise à jour optimiste
      setWs((w) => (w ? { ...w, bag: inBag ? w.bag.filter((x) => x !== claimId) : [...w.bag, claimId] } : w));
      await api("/api/bag", "POST", { action: inBag ? "remove" : "add", claimId });
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<Ctx>(
    () => ({
      ws, refresh, bagOpen, setBagOpen, toggleBag, lang, setLang, t: UI[lang],
      fmtDate: (iso: string) => fmtDateL(iso, lang),
      identity, setIdentity, me: identity.names[identity.role].trim(),
    }),
    [ws, refresh, bagOpen, toggleBag, lang, setLang, identity, setIdentity],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error("useWorkspace outside provider");
  return c;
}

/** POST puis lecture d'un flux SSE. */
export async function postStream(url: string, onEvent: (e: { type: string; [k: string]: unknown }) => void, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-lang": headerLang(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, "");
      buf = buf.slice(i + 2);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: {
      "x-lang": headerLang(),
      ...(body instanceof FormData || body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  return data as T;
}

/** Nouvelle version d'un rapport : le serveur remplit la mappe (claims valides + remplaçants), puis on génère. */
export async function redraft(router: { push: (href: string) => void }, reportId: string) {
  await api(`/api/reports/${reportId}/redraft`, "POST");
  router.push(`/report?generate=1&supersedes=${reportId}`);
}

export const errText = (e: unknown) => String(e instanceof Error ? e.message : e);
