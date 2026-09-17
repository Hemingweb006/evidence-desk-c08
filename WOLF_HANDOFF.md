# Prototype handoff

**Case:** C08 — The field report says it happened. Can we show the evidence?

**Exercise client:** **Schmitz-Stiftungen**, assigned by DaiL.
- The records remain fictional and simulations are labelled.
- Two people approve every report.
- Schmitz-Stiftungen has not commissioned or endorsed this prototype.

**Target users:**
- programme reporting officers (*Projektreferent:innen*);
- the people who review and approve their reports (*Prüfer:innen*).

**Candidate/team:** [your name].

**Prototype location:** this folder (`C08/`), started with `./start.sh` (ngrok link shared at the demo). Add `?lang=en` to the link for English.

## The problem we validated

**Actor, painful moment and consequence.** The reporting officer writes the progress report (*Sachbericht*) from a plan, an attendance sheet and a partner's voice note that do not agree. The risk is reporting a planned or corrected figure as a result ("we trained twenty"). That misleads the foundation's reviewers and, later, its donors.

**Client evidence.** [Quote from the interview. Fill it in from Übersicht → Kundenprotokoll.]

**What the client changed in our understanding.**
- **DaiL feedback, first message.** The walkthrough must:
  - trigger the late assessment;
  - show which *selected* claims become outdated;
  - require review before the report can be approved again.

  Implemented: automatic re-analysis, an impact banner, outdated reports with approval withdrawn and blocked, and versioned redrafts.
- **Uploads.** They must be limited to synthetic exercise material. Implemented: a mandatory declaration plus a code screen for obvious personal data.
- **DaiL feedback, second message: client fit.** The platform should reflect Schmitz-Stiftungen's look, wording and workflow for its target users. Implemented:
  - a German-first interface with an English switch;
  - a look inspired by the public website (green `#228608`, Lato, slim green bar, green footer), with no logo or photos;
  - the foundation's funding vocabulary;
  - a plan-vs-actual table with required justification;
  - a results chain;
  - four-eyes approval with an approval stamp.
- [Add anything else from the interview.]

**What remains an assumption.**
- That reporting officers confirm evidence types.
- That the cue lists (EN/FR/DE) cover partners' real phrasing. There is no Spanish list yet, although many partner projects are in Latin America.
- That "participants who attended at least one session" is the accepted attendance metric.
- That a 10 % deviation from the plan should require a written justification before approval.
- That approval follows a four-eyes principle, with separate preparer and reviewer roles.

## Client-fit design choice (for the walkthrough)

**Plan vs actual (Soll-Ist-Vergleich) at the top of every report.**
- Code shows Soll 20 (PLAN-A) next to Ist 12 (SHEET-A), with the deviation −8 (−40 %).
- The voice note's "twenty" is in the same row, marked **"= Planwert, kein Ergebnis"**.
- The report cannot be approved until the officer writes a justification for the deviation.

**How it serves the users:**
- The officer sees immediately which number is a plan and which is a result: that is the exact trap in the evidence.
- The officer is asked for the explanation a funder expects.
- The reviewer approves from one table and a stamp, instead of re-reading every record.

Other choices, with reasons, are listed in the app under **So funktioniert's** and in the README:
- four-eyes approval with an approval stamp;
- neutral status words ("nicht berichtsfähig");
- the results chain;
- German + English.

## Open and demonstrate it

**Run instructions and start state.**
1. Run `cp .env.example .env.local` and add `DEEPSEEK_API_KEY`.
2. Run `./start.sh`.
3. For the start state, use **Übersicht → Ausgangszustand herstellen**. It loads the supplied `initial.json` unchanged.

**Ordinary path.**
1. Belege → Auswerten.
2. Zahlenaussagen → Berichtsmappe → Berichtsentwurf erstellen (role: Projektreferent:in).
3. Write the Soll-Ist justification.
4. Switch to Prüfer:in → Freigeben.

**Changed-information path.**
1. Approve report v1 with the completion claim C5 (noch kein Nachweis) in it.
2. Go to Übersicht → **Abschlussnachweis wird nachgereicht (SIMULIERT)** → **Simulieren**. With no further click, the app re-analyses, and then:
   - the banner lists C5 as outdated, replaced by C6 (9 abgeschlossen, belegt);
   - v1 becomes **Überholt**; its approval is withdrawn and the stamp reads **UNGÜLTIG – ÜBERHOLT**;
   - approval is blocked in the UI and in the API;
   - *Nächster Schritt* becomes "Jetzt neu erstellen".
3. Redraft → v2, with the unchanged justification carried over → Freigeben. v1 stays in the history as *überholt · ersetzt*.

**Failure or uncertainty path.**
- "We trained twenty… I mean planned for twenty" → nicht berichtsfähig.
- Completion → noch kein Nachweis (not zero).
- The Friday joiners (simulated coordinator note) → Rückfrage nötig.
- Self-approval, approval in the officer role, or approval without a justification → refused by the server.
- If the writer invents a number, the checker rejects it, separately for German and English. After two failures, a safe template is used for that language.

## What is real

| Component | Implemented or simulated | Evidence and limitation |
|---|---|---|
| Client look and wording | Implemented, inspired by the public website | No logo, photos or real data. Not endorsed by the client. |
| Input and event trigger | Upload/paste implemented, synthetic material only. Incoming events **simulated** (labelled), then automatic re-analysis. | No scans/OCR. The screen catches obvious patterns only. |
| Retrieval / reasoning | Implemented: rules + DeepSeek closed questions (2 readings) + code decisions. Texts in DE + EN, each checked. | Cue lists are EN/FR/DE and finite. One derivation rule. |
| Plan vs actual, results chain | Implemented by code | The 10 % threshold is an assumption. Justifications are human text and not machine-checked. |
| Human review | Implemented: checkpoint, four-eyes rule on the server, approval stamp with fingerprint, audit trail, withdrawal on late evidence | Roles and names are **simulated** (no authentication). |
| External action | **None** (by design) | No partner message, no publication. |
| Persistence and history | Implemented: local JSON (workspace, cache, checkpoints, traces, audit trail) | Single workspace, single machine. |

## Next client validation

**One real case we would test.** One past reporting period, with its real plan, sign-in sheets, voice note or e-mail, and assessment. A reporting officer prepares the report; a second person approves it.

**What counts as success.**
- No figure the officer rejects is marked *belegt*.
- At least 80 % of the officer's figures are found.
- Drafting time is halved.
- The reviewer can approve from the Soll-Ist table and the stamp without re-opening the records.

**Who evaluates it.** The reporting officer and the approving reviewer.

## Wolf work

**Required integration and permission.**
- Read access to the partner reporting inbox or portal, and to attendance/assessment exports.
- Write access to a draft-report store.
- Single sign-on with two roles (preparer, approver).
- No publishing permission for the system.

**Data boundary and model processing location.**
- Participant-level data should be minimised or aggregated before model calls.
- The model is used only for closed questions and for writing from the validated table.
- The processing location must be agreed. It is currently the DeepSeek API; production would move to an EU-hosted model.

**Failure/recovery plan.**
- Model failure → the reading becomes "unclear" (safe).
- Writer failure → deterministic template, per language.
- Checkpoints keep pending approvals.
- Re-analysis is idempotent, with stable claim IDs.
- Late evidence withdraws approvals automatically.

**Monitoring owner.** [Name.] Watch:
- the rate of *Rückfrage nötig* claims (completeness);
- any *belegt* claim later rejected by a reviewer (must stay at zero);
- writer rejections per language;
- blocked self-approvals.

**Scope and effort drivers.**
- Real document parsing (PDF/scans).
- Partner vocabulary, including Spanish for Latin American projects.
- Additional derivation rules.
- Real authentication and roles.
- Agreed deviation thresholds.
- Multi-programme workspaces.

No invented price or delivery commitment.

**Next action and owner.** Run the real-case validation above with a reporting officer and a reviewer. Owner: [name].
