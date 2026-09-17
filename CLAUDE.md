@AGENTS.md

# Evidence Desk (C08) — conventions

- UI in German by default with an English switch (`src/lib/i18n/ui.ts`, `terms.ts`); code comments may be French. Every new UI string goes into both dictionaries.
- Server texts that users see (reasons, checks, card texts, report sections, errors) exist in both languages: `claim.de`, `report.texts.{de,en}`, `i18n/server.ts`.
- DeepSeek only (event rule). Models: reader/questions `deepseek-flash`, writer `deepseek-v4-pro`, thinking disabled by default.
- Golden rule: **models never decide a status**. Every status comes from `src/lib/engine/decide.ts` and can only go down.
- Any new graph step: declare its tools in `harness/permissions.ts`, wrap it with `traced()`, emit checks.
- Any text a model writes must pass a code check (numbers ⊂ cited claims) or fall back to a template.
- Never modify the supplied `initial.json` data (`src/lib/sample.ts`); simulated records carry the `SIM-` prefix and `origin: "simulated"`.
- Before a demo: `npm run typecheck`, `npm run build`, `npm run evals` (server running) — safety must be 100 %.
- Client context: **Schmitz-Stiftungen** (`CLIENT_NAME` in `sample.ts`). Records stay fictional. The look (green #228608, Lato) is inspired by the public site: never use the client's logo or photos; keep the exercise disclaimer visible.
- Soll-Ist and Wirkungskette: `engine/plan-actual.ts` (code only). Deviations ≥ 10 % need a justification before approval.
- Four-eyes: `reviewReport` requires role `reviewer` and a name different from `preparedBy`.
- Late evidence: `engine/impact.ts` compares claims after each analysis. Affected reports get status `outdated`, and `reviewReport` refuses them. A new version (`supersedes`) must be reviewed.
- Uploads: synthetic material only (declaration + `engine/synthetic-guard.ts`).
