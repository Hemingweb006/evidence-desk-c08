/** Langues de l'interface : allemand par défaut (client Schmitz-Stiftungen), anglais pour le jury. */
export type Lang = "de" | "en";
export const LANGS: Lang[] = ["de", "en"];
export const DEFAULT_LANG: Lang = "de";
export type LText = Record<Lang, string>;
export const lt = (de: string, en: string): LText => ({ de, en });
export const isLang = (x: unknown): x is Lang => x === "de" || x === "en";
export const langFrom = (x: unknown): Lang => (isLang(x) ? x : DEFAULT_LANG);

export const LOCALE: Record<Lang, string> = { de: "de-DE", en: "en-GB" };

export function fmtDateL(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(LOCALE[lang], { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
