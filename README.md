# Evidence Desk — C08 prototype for Schmitz-Stiftungen (exercise client)

> **“The field report says it happened. Can we show the evidence?”**
> Evidence Desk turns a plan, an attendance sheet, a voice note and an assessment into **claims you can inspect**. It then turns them into a **progress report (Sachbericht) that keeps the uncertainty visible**. Nothing leaves draft until a **second person** approves it.

This is a prototype for the DaiL Octopus day. Key points:

- **Exercise client: Schmitz-Stiftungen**, assigned by DaiL. The prototype is not commissioned or endorsed by the client.
- **Target users:**
  - programme **reporting officers** (*Projektreferent:innen*);
  - the **people who review and approve their reports** (*Prüfer:innen*).
- **Data:**
  - all records are fictional;
  - `initial.json` from the C08 pack is used **unchanged**;
  - every additional record is **labelled SIMULATED**;
  - uploads are limited to **synthetic exercise material**.
- **Actions:** nothing is sent or published.

---

## Run it

```bash
cp .env.example .env.local        # paste DEEPSEEK_API_KEY (optionally DEMO_PASSWORD)
./start.sh                        # npm install → build → start on :3000 → ngrok tunnel
```

- **Without ngrok:** `npm install && npm run build && npm start`, then open http://localhost:3000.
- **Language:** German by default (the client's language). Switch with **Deutsch | English** in the green top bar, or share an English link with `?lang=en` (for example `https://…ngrok…/?lang=en`).
- **Share the demo:**
  1. Install ngrok (`brew install ngrok`, then `ngrok config add-authtoken …`).
  2. Run `./start.sh`. It prints a public `https://…ngrok…` link.
- **Protect the demo:** set `DEMO_PASSWORD` in `.env.local`. Visitors are then asked for user `dail` and that password.
- **Repeatable start state:** **Übersicht → Ausgangszustand herstellen** (Overview → Reset start state), or `POST /api/reset`.
- **Evaluations** (with the server running): `npm run evals`, or `python3 evals/run_evals.py --base http://localhost:3000 --runs 3`.

## Put it on GitHub

The repository is ready to push. `.gitignore` keeps out `.env.local` (your key), `node_modules`, `.next`, `data/runtime/` (workspace, model cache, checkpoints) and local archives.

**Keep the repository private** unless DaiL agrees otherwise. It contains the C08 exercise data, and it uses a real organisation's name for an exercise. Invite reviewers under *Settings → Collaborators*.

### Live demo from GitHub (Codespaces)

GitHub Pages cannot run this app: it needs a Node server, API routes and a secret key. GitHub Codespaces can.

1. Add the secrets under *Settings → Secrets and variables → Codespaces*:
   - `DEEPSEEK_API_KEY`;
   - `DEMO_PASSWORD` (strongly recommended, because a public port needs no GitHub sign-in).
2. Create a codespace: *Code → Codespaces → Create codespace on main*. `.devcontainer/devcontainer.json` installs Node 22 and the dependencies.
3. In the codespace terminal, run `./start.sh`.
4. In the **PORTS** tab, right-click port 3000 → **Port Visibility → Public**, then copy the URL. Add `?lang=en` for English. Visitors sign in with user `dail` and your `DEMO_PASSWORD`.

The codespace stops when idle, and the demo data lives inside that codespace.

For a permanent host, use a service that runs a Node server with a persistent disk for `data/runtime/`. Serverless hosting does not keep the files the app writes, so the approval checkpoints would be lost.

## Client fit: design choices and how they serve the users

The design follows the foundation's public website and its funding vocabulary:

- **Look:** sober white pages, green `#228608`, Lato, a slim green top bar and a green footer.
- **Language:** German first.
- **Vocabulary:**
  - *Zielindikatoren*, *Resultate (Output)* and *Wirkungen* from the application template;
  - *Hilfe zur Selbsthilfe* and a trusting partnership, from the mission statement (*Leitbild*).

The logo, photos and any real data are **not** used; the prototype has its own mark.

| Choice | What the user sees | Why it helps these users |
|---|---|---|
| **Plan vs actual (Soll-Ist-Vergleich), the headline choice** | At the top of every report, code shows Soll 20 (PLAN-A), Ist 12 (SHEET-A) and the deviation −8 (−40 %). The voice note's "twenty" appears in the same row, marked **"= Planwert, kein Ergebnis"**. From a 10 % deviation, a written **Begründung** is required before approval. | The officer sees at once which figure is a plan and which is a result: that is exactly the trap in the voice note. The officer is also asked for the explanation a funder expects. The reviewer checks one table instead of re-reading every record. |
| **Four-eyes principle (Vier-Augen-Prinzip) + approval stamp (Prüfvermerk)** | Roles: *Projektreferent:in* prepares, *Prüfer:in* approves. The server refuses self-approval, the wrong role and a missing justification. The printed stamp shows who prepared, who approved, the version, the evidence used and a document fingerprint. | This follows common approval practice (to be confirmed with the client). A printed report shows exactly what was approved. |
| **Neutral status words** | *belegt* · *Planwert (Soll)* · *Rückfrage nötig* · *noch kein Nachweis* · *nicht berichtsfähig*. Partner questions are polite and specific. | The figure stays out of the report without accusing the partner, in line with the trusting partnership the mission statement describes. |
| **Results chain (Wirkungskette)** | Planung → Maßnahmen → Leistungen → Resultate → Wirkungen. Each level is shown as *belegt*, *offen* or *nicht belegbar*. | It uses the application template's terms and stops reports from overstating impact. |
| **German + English** | Interface, card texts and both report versions (each written and machine-checked separately). | Officers work in German; the DaiL jury and international reviewers read the same data in English. |

## Demo path (about 5 minutes, German UI)

1. **Übersicht (Overview).**
   - The *Nächster Schritt* (next action) card says what to do.
   - The green bar says it is an exercise.
   - The sidebar shows the simulated sign-in: role **Projektreferent:in**.
2. **1 · Belege (Evidence).**
   - The four supplied records are shown; the rules highlight every number.
   - Press **Belege auswerten** (about 10 s).
3. **2 · Zahlenaussagen (Claims).** One card per number:
   - "We trained twenty… *I mean* planned for twenty" → **Nicht berichtsfähig**.
   - 12 attended → **Belegt**.
   - 20 in the plan → **Planwert (Soll)**.
   - Completion → **Noch kein Nachweis** (C5), not zero.
   - Open *Warum dieser Status?* to show the closed question, both readings and every check.
4. **Berichtsmappe (bag of claims).**
   - Press *Alle belegten Werte und Planwerte übernehmen*, then also add C5 and the not-reportable C3.
   - The folder previews the Soll-Ist table.
   - Press **Berichtsentwurf erstellen**. The German and English drafts are written from the folder only, and both pass the machine checks.
5. **Report v1, the key design choice.**
   - The **Soll-Ist** table flags **−40 %** and "Begründung fehlt".
   - As *Projektreferent:in*, type a justification (or click *Begründung beim Projektpartner angefragt*) and save.
   - The approval box says the officer cannot approve their own draft.
6. **Four-eyes approval.**
   - Click *In die Rolle Prüfer:in wechseln*, then **Freigeben** (approve).
   - The stamp turns to **FREIGEGEBEN**, with a fingerprint. The audit trail (*Prüfprotokoll*) lists every step.
   - To show the guard, change the reviewer name to the author's name: approval is refused.
7. **Late assessment (changed-information path).**
   - Go to Übersicht and press **Simulieren** on *Abschlussnachweis wird nachgereicht (SIMULIERT)*. Without another click, the app:
     - adds `SIM-ASSESS-B` and re-analyses;
     - shows a red banner on every page, listing the **selected claims that became outdated**: C5 "noch kein Nachweis" is replaced by C6 "9 abgeschlossen, belegt";
     - marks the approved v1 **Überholt – erneute Freigabe nötig** and withdraws its approval;
     - changes the stamp to **UNGÜLTIG – ÜBERHOLT** and highlights the outdated chips;
     - **blocks approval** in the UI and in the API (`POST /review` returns 400);
     - changes the *Nächster Schritt* card to "Bericht v1 ist überholt → Jetzt neu erstellen".
8. **Redraft.**
   - The folder is rebuilt from the valid claims plus their replacements (C5 → C6).
   - The unchanged Soll-Ist justification is carried over, and labelled as such.
   - v2 stops at the approval checkpoint. **Freigeben** v2: the banner disappears, and v1 stays in the history as *überholt · ersetzt*.
9. **English.** Click **English** in the top bar. The same report, claims and stamp appear in English.
10. **Uploads.**
    - Uploading is disabled until you tick *Nur fiktives Übungsmaterial*.
    - A file with an e-mail address, phone number, IBAN, birth date or street address is refused.
11. **Verarbeitungsprotokoll** (traces) and **So funktioniert's** (how it works; includes the design-choices table).

Optional: *Standort D laden* loads a simulated German-language partner pack, and *Standort C* a French one. Both are labelled.

## How the anti-hallucination pipeline works

| Step | Who | What |
|---|---|---|
| Find numbers | Rules | Digits and number words (EN/FR/DE) and approximations. Whole-word cues for corrections, hedging, absence and units (EN/FR/DE, e.g. "ich meine", "rund", "liegt noch nicht vor"). |
| M1 · Questions | `deepseek-flash` | One **closed** question per number, with options from a fixed list plus "unclear". Leading questions are replaced by a template. |
| M2 · Readings | `deepseek-flash` | **Two independent readings** with shuffled options. Each returns a choice, a modality and the full sentence. |
| Decide | **Code** | Evidence-type ceiling, correction and hedge cues, unit agreement, quote check, absence = no evidence, conflicts. The **status can only go down**. Every reason and check is written in German and English. |
| Card texts | `deepseek-flash` | German and English in one call, **each checked separately**: no new number, no false certainty. A rejected text falls back to a template, and the reason is traced. |
| Plan vs actual, results chain | **Code** | Soll, Ist, deviation (%), justification requirement (≥ 10 %), chain levels. No model is involved. |
| M3 · Report | `deepseek-v4-pro` | Two writers (DE, EN) in parallel. Each sees **only the validated claim table** (with German labels for German). The checker rejects, per language, any number or section that does not match a cited claim. After 2 failures, a deterministic template writes that language. |
| Approval | **Two people** | LangGraph `interrupt` checkpoint (survives a restart). Four-eyes and justification rules are enforced by the server. "Request changes" creates a locked rule. A fingerprint of the approved content is stored. |
| Late evidence | **Code** | After each analysis, every claim in the folder or in a live report is compared with the new result. Affected reports become **outdated**: their approval is withdrawn, and approval is blocked until a new version is approved. Approval is also refused while evidence is unanalysed. |

## What is real and what is simulated

| Component | Status | Notes |
|---|---|---|
| Client context and look | Exercise assignment; look and wording inspired by the public website | No logo, photos or real data. Not commissioned or endorsed by Schmitz-Stiftungen. |
| Input and event trigger | Real upload/paste (`.json`, `.txt`, `.md`, `.csv`), **synthetic material only** (declaration + code screen). Incoming events are **simulated** (labelled buttons) and trigger re-analysis automatically. | No scans/PDF/OCR. The personal-data screen catches obvious patterns only. |
| Retrieval and reasoning | Real DeepSeek calls (reader, writer); real rule and code engine | Model readings and card texts are cached per record. |
| Roles and sign-in | **Simulated** role switch with free names; the four-eyes rule is real (server-side) | No authentication; optional demo password only. |
| Human review | Real checkpoint and decision; outdated reports need a newly approved version | — |
| External action | **None** | No message to partners, no publication. |
| Persistence and history | Local JSON files in `data/runtime/` | Workspace, cache, checkpoints, traces, audit trail. |

## Measured results

From `npm run evals` with 3 fresh runs per case (no cache). There are four cases:

- the supplied data;
- the supplied data plus simulated updates;
- a French pack;
- a German pack.

The report templates are checked in German and English.

| Metric | Result |
|---|---|
| **Safety:** runs with no misleading figure marked Verified/Target, and templates that pass the checker in both languages | **12 / 12** |
| **Completeness:** expected findings detected (13 findings × 3 runs; see list below) | **39 / 39** |
| Analysis time | about 8–13 s (card texts in two languages) |
| Report time | about 8–30 s (two languages in parallel), more if a writer retries |

The completeness findings are:

- from the supplied data and updates: 12 attended; target 20; unknown completion; 9 completed after the update; Friday joiners flagged;
- from the French pack: 17 unique attendees computed; 10 passed; target 25; "une trentaine" not reportable;
- from the German pack: 18 attended; target 30; "liegt noch nicht vor" = no evidence yet.

Before building, we compared approaches on the same packs (see **So funktioniert's** in the app). A three-model pipeline *without* these guardrails produced misleading figures in 4–5 runs out of 9.

## Limitations

- **Data:** four small datasets, three of them synthetic.
  - Real partner evidence will contain phrasings that are not yet in the cue lists (EN/FR/DE). Those fall back to "unclear", which is safe but less complete.
  - There is no Spanish cue list yet, although many partner projects are in Latin America.
- **Rules:**
  - only one derivation rule (union of two days minus the overlap);
  - the 10 % justification threshold is our assumption; it should be agreed with the client.
- **Human inputs:**
  - evidence types must be confirmed by a person;
  - justifications are typed by a person and are **not** machine-checked (the UI says so).
- **Access and scope:** roles are simulated (no real login); single local workspace; no scanned-document parsing.
- **Evaluation:** the judge of success is our own checklist. It still needs validation on real reports.

## Next validation test

Take **one real past reporting period** from the client: plan, sign-in sheets, one voice note or e-mail, and the assessment. A reporting officer marks the figures they would publish. A reviewer approves the draft using the four-eyes flow.

**Success:**

- zero figures that the officer rejects appear as *belegt*;
- at least 80 % of the officer's figures are found;
- the draft takes less than half of today's time;
- the reviewer can approve from the Soll-Ist table and the stamp without re-opening the records.

**Evaluators:** the reporting officer and the approving reviewer.
