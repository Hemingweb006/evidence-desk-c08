import { lt, type LText } from "../i18n/core";

/**
 * Garde « matériel d'exercice synthétique uniquement » (consigne DaiL).
 * Deux verrous : (1) la personne déclare que le fichier est synthétique ;
 * (2) le code refuse tout ce qui ressemble à une donnée personnelle réelle.
 * Ce n'est pas un détecteur complet : il bloque les cas évidents, il ne certifie rien.
 */
const PATTERNS: { name: LText; re: RegExp }[] = [
  { name: lt("eine E-Mail-Adresse", "an e-mail address"), re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  {
    name: lt("eine Telefonnummer", "a phone number"),
    re: /(?:\+\d{1,3}[\s./-]?\(?\d{1,4}\)?(?:[\s./-]?\d{2,4}){2,})|(?:\b0\d{2,4}[\s/-]\d{3,}(?:[\s/-]\d{2,})?\b)/,
  },
  { name: lt("eine IBAN", "an IBAN"), re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/ },
  { name: lt("ein Geburtsdatum", "a date of birth"), re: /\b(?:date of birth|born on|geboren am|geb\.|né(?:e)? le|DOB)\b/i },
  {
    name: lt("eine Straßenadresse", "a street address"),
    re: /\b\d{1,4}\s+\p{Lu}[\p{L}-]+\s+(?:street|st\.|avenue|road)\b|\b\p{Lu}[\p{L}-]*(?:straße|strasse|weg|allee)\s+\d{1,4}\b/iu,
  },
];

export function personalDataHits(text: string): LText[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

export function joinHits(hits: LText[]): LText {
  return lt(hits.map((h) => h.de).join(" und "), hits.map((h) => h.en).join(" and "));
}
