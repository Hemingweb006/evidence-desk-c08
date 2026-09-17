"use client";

import { ArrowRight } from "lucide-react";
import { Loading, PageHeader, Pill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

type Content = {
  title: string;
  sub: string;
  fitTitle: string;
  fitSub: string;
  fit: { tag: string; title: string; body: string; serves: string }[];
  trapsTitle: string;
  traps: { q: string; a: string }[];
  pipeTitle: string;
  steps: { who: string; title: string; body: string }[];
  harnessTitle: string;
  harness: [string, string][];
  measuredTitle: string;
  measuredSub: string;
  colApproach: string;
  colViol: string;
  results: { a: string; viol: string; note: string }[];
  realTitle: string;
  real: [string, string][];
  whoLabel: Record<string, string>;
};

const EN: Content = {
  title: "How it works",
  sub: "The client’s question: how can mixed evidence become a reviewable progress report without polishing away uncertainty? Our answer: the model never decides what is true. It only answers closed questions; code decides; two people sign off.",
  fitTitle: "Design choices for Schmitz-Stiftungen’s reporting officers and reviewers",
  fitSub: "Guided by the foundation’s public site (sober white pages, green accents, Lato, German first) and its funding language (targets, results, “help for self-help”, partnership).",
  fit: [
    {
      tag: "Main choice",
      title: "Plan vs actual (Soll-Ist) at the top of every report",
      body: "Code places the target (20, PLAN-A) next to the evidenced actual figure (12, SHEET-A) and computes the deviation (−8, −40 %). The voice note’s “twenty trained” appears in the same row, marked “= plan value, not a result”. A deviation of 10 % or more needs a written justification before anyone can approve.",
      serves: "The officer sees at once which number is a plan and which is a result — exactly the trap in the voice note — and is asked for the explanation a funder expects. The reviewer checks one table instead of re-reading every record.",
    },
    {
      tag: "Governance",
      title: "Four-eyes principle with an approval stamp",
      body: "Drafts are prepared in the reporting-officer role; approval needs the reviewer role and a different name (checked by the server). The printed stamp shows who prepared, who approved, the version, the evidence used and a fingerprint of the approved content.",
      serves: "Follows common approval practice (to be confirmed with the client): nobody approves their own work, and a printed report shows exactly what was approved.",
    },
    {
      tag: "Tone",
      title: "“Not reportable” instead of “misleading”",
      body: "Statuses use neutral German reporting terms: belegt, Planwert (Soll), Rückfrage nötig, noch kein Nachweis, nicht berichtsfähig. Questions to the partner are polite and specific.",
      serves: "Keeps the relationship with project partners trusting — a core value in the foundation’s mission statement — while still keeping the figure out of the report.",
    },
    {
      tag: "Results chain",
      title: "What the evidence can and cannot show",
      body: "A results chain (planning → activities → outputs → outcomes → impact) marks each level as evidenced, open or not claimable. Impact is never claimable from participation alone.",
      serves: "Uses the vocabulary of the foundation’s application template (Maßnahmen, Resultate, Wirkungen) and stops reports from overstating impact.",
    },
    {
      tag: "Look & language",
      title: "German first, English in one click",
      body: "The interface, card texts and reports exist in German and English. Both report versions are written and machine-checked separately. A slim green bar carries the language switch and the exercise notice.",
      serves: "Officers work in German; international reviewers and the DaiL jury can read the same data in English.",
    },
  ],
  trapsTitle: "The traps in the supplied evidence",
  traps: [
    { q: "“We trained twenty… I mean it was planned for twenty”", a: "A correction later in the sentence. Code sees “I mean” after the number → not reportable. In the plan-vs-actual table, the 20 is shown as equal to the plan value." },
    { q: "“12 unique participants attended at least one session”", a: "Attendance, not training. An attendance record can never prove completion → only attendance is verified." },
    { q: "“No completion assessment has been submitted”", a: "Absence of evidence is not zero → completion has no evidence yet and becomes a question for the partner." },
  ],
  pipeTitle: "The pipeline (LangGraph, every step traced)",
  steps: [
    { who: "rules", title: "Find every number", body: "Digits and number words (EN/FR/DE), plus whole-word cues for corrections, hedging, absence and units. A model cannot invent a number." },
    { who: "m1", title: "Ask closed questions", body: "“What does ‘twenty’ refer to?” with options from a fixed list, always including “unclear”. Leading questions are replaced by code." },
    { who: "m2", title: "Read twice", body: "Two independent readings with shuffled options. Each returns a choice, a modality and the full sentence. Any disagreement → needs follow-up." },
    { who: "code", title: "Decide the status", body: "Evidence ceilings, correction and hedge cues, unit agreement, quote check, absence = no evidence. The status can only go down. Totals, plan-vs-actual and the results chain are computed by code." },
    { who: "m3", title: "Write from the table (DE + EN)", body: "The writer never sees the evidence. A checker rejects any number or section that does not match a cited claim, per language; after two failures a template writes it." },
    { who: "people", title: "Prepare, then approve", body: "The graph stops at a checkpoint. A second person approves (four-eyes). A change request becomes a locked rule; late evidence withdraws the approval." },
  ],
  harnessTitle: "Agent-harness principles, applied",
  harness: [
    ["Machine-checkable “done”", "Every claim has named checks; the report checker verifies every number and section in both languages; deviations need a justification before approval."],
    ["Checkpoints", "The report graph pauses for a human decision and survives a server restart."],
    ["Selective memory", "Reviewer notes become short locked rules — style only, never facts, switchable."],
    ["Tool permissions", "Each step has an allow-list; the writer has no access to the evidence."],
    ["Traces", "Model, tokens, tools, checks and timing for every step (Traces page)."],
    ["Human review where it matters", "Nothing leaves draft without a second, named person; late evidence sends it back."],
  ],
  measuredTitle: "What we measured before building",
  measuredSub: "9 runs per approach: the supplied C08 data plus two labelled synthetic packs, judged against fixed forbidden/required statements. Small sample — a hypothesis to validate on real reports.",
  colApproach: "Approach",
  colViol: "Runs with a misleading claim",
  results: [
    { a: "Three models, no guardrails (v1)", viol: "5 / 9 and 4 / 9", note: "The reader quoted “We trained twenty people” without the correction that followed — a fake proof." },
    { a: "One weak model (Llama 3.2 11B)", viol: "4 / 9", note: "Falls for the double count and the headcount that includes parents." },
    { a: "One strong model (Nemotron 120B)", viol: "1 / 9", note: "" },
    { a: "One reasoning model (DeepSeek v4-pro)", viol: "0 / 9", note: "Safe, but slow (~110 s) and not explainable rule by rule." },
    { a: "Evidence Desk pipeline, weak reader (Llama 3.2 11B)", viol: "0 / 9", note: "Same safety with a weak reader; every status explained by a named rule." },
  ],
  realTitle: "What is real and what is simulated",
  real: [
    ["Client context", "Schmitz-Stiftungen, assigned by DaiL for the exercise. The look and wording are inspired by the public website; no logo, photos or real data are used. Not commissioned or endorsed by the client."],
    ["Evidence input", "Real upload/paste of text files, limited to synthetic exercise material (declaration + code screen for e-mails, phone numbers, IBANs, birth dates, addresses). initial.json is used unchanged. Scans and incoming events are simulated and labelled."],
    ["Late evidence", "Real: after a (simulated) late assessment the app re-analyses on its own, compares every selected claim, marks affected reports outdated and blocks approval until a new version is approved."],
    ["Roles and sign-in", "Simulated: a role switch (reporting officer / reviewer) with free names. The four-eyes rule itself is enforced by the server."],
    ["Reading and reasoning", "Real calls to DeepSeek (reader and writer); number finding, statuses and totals are real code."],
    ["External action", "None. No message is sent to a partner and nothing is published."],
    ["Persistence", "Local JSON files (workspace, reading cache, checkpoints)."],
  ],
  whoLabel: { rules: "Rules", m1: "Model M1", m2: "Model M2", code: "Code", m3: "Model M3", people: "Two people" },
};

const DE: Content = {
  title: "So funktioniert’s",
  sub: "Die Ausgangsfrage: Wie wird aus uneinheitlichen Belegen ein prüfbarer Sachbericht, ohne Unsicherheit wegzuglätten? Unsere Antwort: Das Modell entscheidet nie, was stimmt. Es beantwortet nur geschlossene Fragen; der Code entscheidet; zwei Personen zeichnen ab.",
  fitTitle: "Designentscheidungen für Projektreferent:innen und Prüfer:innen der Schmitz-Stiftungen",
  fitSub: "Orientiert an der öffentlichen Website der Stiftungen (ruhige weiße Seiten, grüne Akzente, Lato, Deutsch zuerst) und an ihrer Fördersprache (Planwerte, Resultate, „Hilfe zur Selbsthilfe“, Partnerschaft).",
  fit: [
    {
      tag: "Zentrale Entscheidung",
      title: "Soll-Ist-Vergleich oben in jedem Bericht",
      body: "Der Code stellt den Planwert (20, PLAN-A) neben den belegten Ist-Wert (12, SHEET-A) und berechnet die Abweichung (−8, −40 %). Die „zwanzig geschulten“ Personen aus der Sprachnachricht stehen in derselben Zeile – markiert als „= Planwert, kein Ergebnis“. Ab 10 % Abweichung ist vor der Freigabe eine schriftliche Begründung nötig.",
      serves: "Projektreferent:innen sehen sofort, welche Zahl Plan und welche Ergebnis ist – genau die Falle der Sprachnachricht – und werden um die Begründung gebeten, die ein Förderer erwartet. Prüfer:innen kontrollieren eine Tabelle, statt jeden Beleg erneut zu lesen.",
    },
    {
      tag: "Governance",
      title: "Vier-Augen-Prinzip mit Prüfvermerk",
      body: "Entwürfe entstehen in der Rolle Projektreferent:in; die Freigabe braucht die Rolle Prüfer:in und einen anderen Namen (vom Server geprüft). Der gedruckte Prüfvermerk zeigt, wer erstellt und wer freigegeben hat, die Fassung, die verwendeten Belege und einen Fingerabdruck des freigegebenen Inhalts.",
      serves: "Folgt gängiger Freigabepraxis (mit der Kundin zu bestätigen): Niemand gibt die eigene Arbeit frei, und ein gedruckter Bericht zeigt genau, was freigegeben wurde.",
    },
    {
      tag: "Tonalität",
      title: "„Nicht berichtsfähig“ statt „irreführend“",
      body: "Die Status nutzen neutrale Berichtsbegriffe: belegt, Planwert (Soll), Rückfrage nötig, noch kein Nachweis, nicht berichtsfähig. Rückfragen an den Projektpartner sind höflich und konkret.",
      serves: "Wahrt das vertrauensvolle, partnerschaftliche Verhältnis zu den Projektpartnern – ein Kern des Leitbilds – und hält die Zahl trotzdem aus dem Bericht heraus.",
    },
    {
      tag: "Wirkungskette",
      title: "Was die Belege zeigen können – und was nicht",
      body: "Eine Wirkungskette (Planung → Maßnahmen → Leistungen → Resultate → Wirkungen) markiert jede Ebene als belegt, offen oder nicht belegbar. Eine Wirkung lässt sich aus Teilnahme allein nie ableiten.",
      serves: "Nutzt das Vokabular des Antragsrasters der Stiftungen (Maßnahmen, Resultate, Wirkungen) und verhindert, dass Berichte Wirkungen überzeichnen.",
    },
    {
      tag: "Erscheinungsbild & Sprache",
      title: "Deutsch zuerst, Englisch mit einem Klick",
      body: "Oberfläche, Kartentexte und Berichte gibt es auf Deutsch und Englisch. Beide Berichtsfassungen werden getrennt geschrieben und maschinell geprüft. Eine schmale grüne Leiste trägt die Sprachwahl und den Übungshinweis.",
      serves: "Referent:innen arbeiten auf Deutsch; internationale Prüfer:innen und die DaiL-Jury lesen dieselben Daten auf Englisch.",
    },
  ],
  trapsTitle: "Die Fallen in den mitgelieferten Belegen",
  traps: [
    { q: "„We trained twenty… I mean it was planned for twenty“", a: "Eine Korrektur weiter hinten im Satz. Der Code erkennt „I mean“ nach der Zahl → nicht berichtsfähig. Im Soll-Ist-Vergleich erscheint die 20 als gleich dem Planwert." },
    { q: "„12 unique participants attended at least one session“", a: "Teilnahme, nicht Schulung. Eine Teilnahmeliste belegt nie einen Abschluss → nur die Teilnahme ist belegt." },
    { q: "„No completion assessment has been submitted“", a: "Fehlender Nachweis ist nicht null → der Abschluss hat noch keinen Nachweis und wird zur Rückfrage an den Projektpartner." },
  ],
  pipeTitle: "Der Ablauf (LangGraph, jeder Schritt protokolliert)",
  steps: [
    { who: "rules", title: "Jede Zahl finden", body: "Ziffern und Zahlwörter (EN/FR/DE) sowie Marker für Korrekturen, Unsicherheit, Fehlen und Einheiten – als ganze Wörter. Ein Modell kann keine Zahl erfinden." },
    { who: "m1", title: "Geschlossene Fragen stellen", body: "„Worauf bezieht sich ‚twenty‘?“ mit Optionen aus einer festen Liste, immer mit „unklar“. Suggestivfragen ersetzt der Code." },
    { who: "m2", title: "Zweimal auswerten", body: "Zwei unabhängige Auswertungen mit gemischten Optionen. Jede liefert Auswahl, Modalität und den vollständigen Satz. Jeder Widerspruch → Rückfrage nötig." },
    { who: "code", title: "Status entscheiden", body: "Obergrenzen je Belegart, Korrektur- und Unsicherheitsmarker, Einheit, Zitatprüfung, Fehlen = kein Nachweis. Der Status kann nur sinken. Summen, Soll-Ist und Wirkungskette berechnet der Code." },
    { who: "m3", title: "Aus der Tabelle schreiben (DE + EN)", body: "Der Schreiber sieht die Belege nie. Eine Prüfung weist jede Zahl und jeden Abschnitt ohne passende Aussage zurück – je Sprache; nach zwei Fehlversuchen schreibt eine Vorlage." },
    { who: "people", title: "Erstellen, dann freigeben", body: "Der Graph hält an einem Prüfpunkt. Eine zweite Person gibt frei (Vier-Augen-Prinzip). Ein Änderungswunsch wird zur festen Regel; ein nachgereichter Beleg zieht die Freigabe zurück." },
  ],
  harnessTitle: "Prinzipien des Agenten-Harness, angewandt",
  harness: [
    ["Maschinell prüfbares „fertig“", "Jede Aussage hat benannte Prüfungen; die Berichtsprüfung kontrolliert jede Zahl und jeden Abschnitt in beiden Sprachen; Abweichungen brauchen vor der Freigabe eine Begründung."],
    ["Prüfpunkte", "Der Berichtsgraph wartet auf eine menschliche Entscheidung und übersteht einen Neustart."],
    ["Selektives Gedächtnis", "Prüfer-Hinweise werden zu kurzen festen Regeln – nur Stil, nie Fakten, abschaltbar."],
    ["Werkzeugrechte", "Jeder Schritt hat eine Erlaubnisliste; der Schreiber hat keinen Zugriff auf die Belege."],
    ["Protokolle", "Modell, Tokens, Werkzeuge, Prüfungen und Dauer je Schritt (Verarbeitungsprotokoll)."],
    ["Menschliche Prüfung, wo es zählt", "Nichts verlässt den Entwurf ohne eine zweite, namentlich genannte Person; ein nachgereichter Beleg schickt ihn zurück."],
  ],
  measuredTitle: "Was wir vor dem Bau gemessen haben",
  measuredSub: "9 Läufe je Ansatz: die C08-Belege plus zwei gekennzeichnete fiktive Pakete, bewertet anhand fester verbotener bzw. geforderter Aussagen. Kleine Stichprobe – eine Hypothese, die an echten Berichten zu prüfen ist.",
  colApproach: "Ansatz",
  colViol: "Läufe mit irreführender Aussage",
  results: [
    { a: "Drei Modelle ohne Leitplanken (v1)", viol: "5 / 9 und 4 / 9", note: "Die Auswertung zitierte „We trained twenty people“ ohne die folgende Korrektur – ein Scheinbeleg." },
    { a: "Ein schwaches Modell (Llama 3.2 11B)", viol: "4 / 9", note: "Fällt auf die Doppelzählung und die Zählung mit Eltern herein." },
    { a: "Ein starkes Modell (Nemotron 120B)", viol: "1 / 9", note: "" },
    { a: "Ein Reasoning-Modell (DeepSeek v4-pro)", viol: "0 / 9", note: "Sicher, aber langsam (~110 s) und nicht Regel für Regel erklärbar." },
    { a: "Evidence-Desk-Ablauf mit schwachem Modell (Llama 3.2 11B)", viol: "0 / 9", note: "Gleiche Sicherheit mit schwachem Modell; jeder Status durch eine benannte Regel erklärt." },
  ],
  realTitle: "Was echt ist und was simuliert",
  real: [
    ["Kundenkontext", "Schmitz-Stiftungen, von DaiL für die Übung zugewiesen. Erscheinungsbild und Wortwahl orientieren sich an der öffentlichen Website; kein Logo, keine Fotos, keine echten Daten. Nicht von den Schmitz-Stiftungen beauftragt oder freigegeben."],
    ["Belegeingang", "Echter Upload bzw. echtes Einfügen von Textdateien, beschränkt auf fiktives Übungsmaterial (Bestätigung + Code-Prüfung auf E-Mail, Telefon, IBAN, Geburtsdatum, Adresse). initial.json wird unverändert genutzt. Scans und eingehende Ereignisse sind simuliert und gekennzeichnet."],
    ["Nachgereichte Belege", "Echt: Nach einem (simulierten) nachgereichten Abschlussnachweis wertet die Anwendung selbst neu aus, vergleicht jede ausgewählte Aussage, markiert betroffene Berichte als überholt und sperrt die Freigabe, bis eine neue Fassung freigegeben ist."],
    ["Rollen und Anmeldung", "Simuliert: ein Rollenwechsel (Projektreferent:in / Prüfer:in) mit frei wählbaren Namen. Die Vier-Augen-Regel selbst setzt der Server durch."],
    ["Auswertung und Schlussfolgerung", "Echte Aufrufe an DeepSeek (Auswertung und Schreiber); Zahlensuche, Status und Summen sind echter Code."],
    ["Externe Aktionen", "Keine. Es wird keine Nachricht an Projektpartner gesendet und nichts veröffentlicht."],
    ["Speicherung", "Lokale JSON-Dateien (Arbeitsstand, Auswertungs-Cache, Prüfpunkte)."],
  ],
  whoLabel: { rules: "Regeln", m1: "Modell M1", m2: "Modell M2", code: "Code", m3: "Modell M3", people: "Zwei Personen" },
};

const WHO_CLS: Record<string, string> = {
  rules: "bg-surface-2 text-ink-2",
  code: "bg-surface-2 text-ink-2",
  people: "bg-accent-soft text-accent-ink",
};

export default function MethodPage() {
  const { ws, lang } = useWorkspace();
  if (!ws) return <Loading />;
  const C = lang === "de" ? DE : EN;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={C.title} sub={C.sub} />

      <div className="card mb-4 border-accent/40 p-5" data-testid="client-fit">
        <div className="text-[17px] font-bold">{C.fitTitle}</div>
        <p className="mb-4 mt-1 text-sm text-ink-2">{C.fitSub}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {C.fit.map((f, i) => (
            <div key={f.title} className={`rounded-[3px] border p-4 ${i === 0 ? "border-accent bg-accent-soft md:col-span-2" : "border-line"}`}>
              <Pill cls={i === 0 ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-2"}>{f.tag}</Pill>
              <div className="mt-2 text-[15px] font-bold">{f.title}</div>
              <p className="mt-1 text-sm leading-6 text-ink-2">{f.body}</p>
              <p className="mt-2 text-sm leading-6">
                <b>{lang === "de" ? "Nutzen: " : "Why it helps: "}</b>
                {f.serves}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-4 p-5">
        <div className="mb-3 text-[15px] font-bold">{C.trapsTitle}</div>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          {C.traps.map((x) => (
            <div key={x.q} className="rounded-[3px] bg-page p-3">
              <div className="font-bold" lang="en">
                {x.q}
              </div>
              <div className="mt-1 text-ink-2">{x.a}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-4 p-5">
        <div className="mb-4 text-[15px] font-bold">{C.pipeTitle}</div>
        <ol className="grid gap-3 md:grid-cols-3">
          {C.steps.map((s, i) => (
            <li key={s.title} className="relative rounded-[3px] border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{i + 1}</span>
                <span className="text-sm font-bold">{s.title}</span>
                <Pill cls={WHO_CLS[s.who] ?? "bg-target-soft text-target-ink"}>{C.whoLabel[s.who]}</Pill>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-2">{s.body}</p>
              {i < C.steps.length - 1 && <ArrowRight size={14} className="absolute -right-3 top-1/2 hidden text-muted md:block" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 text-[15px] font-bold">{C.harnessTitle}</div>
          <table className="w-full text-xs leading-5">
            <tbody>
              {C.harness.map(([k, v]) => (
                <tr key={k} className="border-t border-line align-top first:border-t-0">
                  <td className="py-2 pr-3 font-bold">{k}</td>
                  <td className="py-2 text-ink-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="mb-1 text-[15px] font-bold">{C.measuredTitle}</div>
          <p className="mb-3 text-xs text-muted">{C.measuredSub}</p>
          <table className="w-full text-xs leading-5">
            <thead className="text-left text-muted">
              <tr>
                <th className="pb-1">{C.colApproach}</th>
                <th className="pb-1">{C.colViol}</th>
              </tr>
            </thead>
            <tbody>
              {C.results.map((r) => (
                <tr key={r.a} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2">
                    <div className="font-bold">{r.a}</div>
                    {r.note && <div className="text-muted">{r.note}</div>}
                  </td>
                  <td className="tabular py-1.5">{r.viol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-4 p-5">
        <div className="mb-3 text-[15px] font-bold">{C.realTitle}</div>
        <table className="w-full text-xs leading-5">
          <tbody>
            {C.real.map(([k, v]) => (
              <tr key={k} className="border-t border-line align-top first:border-t-0">
                <td className="w-44 py-2 pr-3 font-bold">{k}</td>
                <td className="py-2 text-ink-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
