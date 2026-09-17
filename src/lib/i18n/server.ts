import { langFrom, type Lang, type LText } from "./core";

/** Messages d'erreur métier, dans les deux langues. */
const ERR = {
  emptyBag: { de: "Die Berichtsmappe ist leer.", en: "The report folder is empty." },
  reportNotFound: { de: "Bericht nicht gefunden.", en: "Report not found." },
  notFound: { de: "Nicht gefunden.", en: "Not found." },
  outdated: {
    de: "Dieser Bericht ist überholt: Ein nachgereichter Beleg hat verwendete Zahlenaussagen geändert. Erstellen Sie eine neue Fassung mit den aktuellen Aussagen und lassen Sie diese freigeben.",
    en: "This report is outdated: new evidence changed claims it uses. Redraft it with the current claims, then have the new version approved.",
  },
  notWaiting: { de: "Dieser Bericht wartet nicht auf eine Freigabe.", en: "This report is not waiting for review." },
  superseded: { de: "Es gibt eine neuere Fassung dieses Berichts. Bitte prüfen Sie diese.", en: "A newer version of this report exists. Review that one instead." },
  unread: {
    de: "Neue Belege wurden noch nicht ausgewertet ({ids}). Bitte vor jeder Freigabe neu auswerten.",
    en: "New evidence has not been analysed yet ({ids}). Re-analyse before any approval.",
  },
  staleAtReview: {
    de: "Die Zahlenaussagen {ids} haben sich seit diesem Entwurf geändert. Der Bericht ist jetzt überholt: Bitte neu erstellen.",
    en: "Claims {ids} changed since this draft was written. It is now outdated: redraft before approving.",
  },
  roleReviewer: {
    de: "Freigeben oder eine Überarbeitung anfordern kann nur die Rolle „Prüfer:in“.",
    en: "Only the reviewer role can approve or request changes.",
  },
  fourEyes: {
    de: "Vier-Augen-Prinzip: {name} hat diesen Bericht erstellt und darf ihn nicht selbst freigeben. Eine zweite Person muss prüfen.",
    en: "Four-eyes principle: {name} prepared this report and cannot approve it. A second person must review it.",
  },
  justification: {
    de: "Vor der Freigabe muss die Abweichung vom Planwert begründet werden: {rows}.",
    en: "Before approval, the deviation from the plan must be justified: {rows}.",
  },
  legacy: {
    de: "Dieser Entwurf stammt aus einer älteren Version der Anwendung. Bitte neu erstellen.",
    en: "This draft comes from an older version of the app. Please redraft it.",
  },
  noValidClaims: {
    de: "Keine Zahlenaussage dieses Berichts ist noch gültig. Bitte auf der Seite „Zahlenaussagen“ neu auswählen.",
    en: "None of this report's claims are still valid. Pick claims on the Claims page.",
  },
  roleOfficer: { de: "Begründungen erfasst die Rolle „Projektreferent:in“.", en: "Justifications are entered by the reporting officer role." },
  notDraft: { de: "Nur ein Entwurf kann bearbeitet werden.", en: "Only a draft can be edited." },
  nameRequired: { de: "Bitte geben Sie Ihren Namen an.", en: "Enter your name." },
  noteRequired: {
    de: "Bitte erläutern Sie die Änderung: Ihr Hinweis wird zur festen Regel für den nächsten Entwurf.",
    en: "Explain the change: your note becomes a locked rule for the next draft.",
  },
  unknownSim: { de: "Unbekannte Simulation.", en: "Unknown simulation." },
  syntheticConfirm: {
    de: "Bitte bestätigen Sie, dass es sich um fiktives Übungsmaterial handelt. {notice}",
    en: "Confirm that this is synthetic exercise material. {notice}",
  },
  personalData: { de: "{name} scheint {hits} zu enthalten. {notice}", en: "{name} looks like it contains {hits}. {notice}" },
  fileTooLarge: { de: "{name} ist größer als 2 MB.", en: "{name} is larger than 2 MB." },
  fileType: {
    de: "{name}: In diesem Prototyp werden nur .json, .txt, .md und .csv unterstützt.",
    en: "{name}: only .json, .txt, .md and .csv are supported in this prototype.",
  },
  pasteInvalid: { de: "Bitte geben Sie der Notiz einen Namen und etwas Text.", en: "Give the note a name and at least a few words." },
  suppliedDelete: {
    de: "Mitgelieferte Belege können nicht entfernt werden. Nutzen Sie „Ausgangszustand herstellen“.",
    en: "Supplied records cannot be removed. Use “Reset start state” instead.",
  },
  invalid: { de: "Ungültige Eingabe.", en: "Invalid input." },
  whoWhat: { de: "Bitte „Wer“ und „Was“ ausfüllen.", en: "Fill in who and what." },
  notice: {
    de: "Bitte nur fiktives Übungsmaterial hinzufügen – keine echten Daten der Stiftung, von Projektpartnern oder Teilnehmenden.",
    en: "Only synthetic exercise material may be added. Do not upload real foundation, partner or participant records.",
  },
} satisfies Record<string, LText>;

export type ErrKey = keyof typeof ERR;
type Vars = Record<string, string | number | LText>;

export function msg(key: ErrKey, lang: Lang, vars: Vars = {}): string {
  return ERR[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = k === "notice" && !(k in vars) ? ERR.notice : vars[k];
    if (v === undefined) return "";
    return typeof v === "object" ? v[lang] : String(v);
  });
}

export class AppError extends Error {
  constructor(public key: ErrKey, public vars: Vars = {}, public status = 400) {
    super(msg(key, "en", vars));
  }
}

export const langOf = (req: Request): Lang => langFrom(req.headers.get("x-lang") ?? new URL(req.url).searchParams.get("lang"));

export function errorResponse(e: unknown, lang: Lang, fallbackStatus = 500) {
  if (e instanceof AppError) return Response.json({ error: msg(e.key, lang, e.vars), code: e.key }, { status: e.status });
  return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: fallbackStatus });
}
