"use client";

import { LANGS } from "@/lib/i18n/core";
import { useWorkspace } from "./workspace";

const LANG_NAME = { de: "Deutsch", en: "English" } as const;

/** Barre verte fine (comme la charte du client) : mention d'exercice + choix de langue. */
export function TopBar() {
  const { t, lang, setLang } = useWorkspace();
  return (
    <div className="no-print bg-accent text-[12px] text-on-accent">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 md:px-6">
        <nav aria-label={t.top.langLabel} className="flex items-center gap-1 font-bold">
          {LANGS.map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>|</span>}
              <button
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                lang={l}
                className={`rounded-sm px-0.5 hover:underline ${lang === l ? "underline underline-offset-2" : "opacity-85"}`}
              >
                {LANG_NAME[l]}
              </button>
            </span>
          ))}
        </nav>
        <span className="min-w-0 flex-1 text-right">{t.top.disclaimer}</span>
      </div>
    </div>
  );
}

export function Footer() {
  const { t } = useWorkspace();
  return (
    <footer className="no-print mt-8 bg-accent px-4 py-5 text-[13px] leading-6 text-on-accent md:px-8">
      <div className="font-bold">{t.footer.line1}</div>
      <div className="opacity-90">{t.footer.line2}</div>
    </footer>
  );
}
