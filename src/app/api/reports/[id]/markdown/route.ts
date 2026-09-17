import { fmt } from "@/lib/engine/decide";
import { langFrom } from "@/lib/i18n/core";
import { REPORT_STATUS_L, STATUS_L, claimView } from "@/lib/i18n/terms";
import { UI } from "@/lib/i18n/ui";
import { getWorkspace } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: RouteContext<"/api/reports/[id]/markdown">) {
  const { id } = await ctx.params;
  const lang = langFrom(new URL(req.url).searchParams.get("lang"));
  const t = UI[lang];
  const de = lang === "de";
  const w = getWorkspace();
  const r = w.reports.find((x) => x.id === id);
  if (!r) return new Response(t.common.notFound, { status: 404 });
  const text = r.texts?.[lang] ?? { title: r.title, sections: r.sections };
  const byId = new Map(r.claimsSnapshot.map((c) => [c.id, c]));
  const chip = (cid: string) => {
    const c = byId.get(cid);
    return c ? `[${cid} · ${c.evidenceId} · ${c.period}]` : `[${cid}]`;
  };
  const status =
    r.status === "approved"
      ? `${t.stamp.approved} — ${r.review?.reviewer} · ${r.review?.at.slice(0, 10)} · ${t.stamp.fingerprint} ${r.review?.fingerprint ?? "—"}`
      : r.status === "outdated"
        ? `${REPORT_STATUS_L[lang].outdated} — ${r.outdated?.changedClaimIds.join(", ")}`
        : REPORT_STATUS_L[lang][r.status];
  const lines = [
    `# ${text.title || t.report.defaultTitle}`,
    "",
    `**${de ? "Status" : "Status"}:** ${status}  `,
    `**${t.report.preparedFor}:** ${w.client ?? "Schmitz-Stiftungen"}  `,
    `**${de ? "Berichtszeitraum" : "Period"}:** ${r.period}  `,
    `**${t.stamp.version}:** v${r.version ?? 1}  `,
    `**${t.stamp.preparedBy}:** ${r.preparedBy ?? "—"}  `,
    `**${de ? "Hinweis" : "Notice"}:** ${t.top.disclaimer}. ${t.report.notice}.`,
    "",
  ];
  if (r.planActual) {
    lines.push(`## ${t.pa.title}`, "", `| ${t.pa.colIndicator} | ${t.pa.colPlan} | ${t.pa.colActual} | ${t.pa.colDeviation} |`, "|---|---|---|---|");
    for (const row of r.planActual.rows) {
      const sg = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
      const dev = row.deviation ? `${sg(row.deviation.abs)} (${sg(row.deviation.pct)} %)` : "—";
      lines.push(
        `| ${t.pa.row[row.key]} | ${row.soll ? `${row.soll.value} (${row.soll.claimId}, ${row.soll.evidenceId})` : "—"} | ${row.ist ? `${row.ist.value} (${row.ist.claimId}, ${row.ist.evidenceId})` : row.open.length ? t.pa.noEvidence : t.pa.notSelected} | ${dev} |`,
      );
    }
    for (const row of r.planActual.rows.filter((x) => x.needsJustification)) {
      const n = r.deviationNotes?.[row.key];
      lines.push("", `**${t.pa.justification} (${t.pa.row[row.key]}):** ${n ? `${n.text} — ${n.by}` : t.pa.missing}`);
    }
    lines.push("", `**${t.pa.chainTitle}:** ${r.planActual.chain.map((c) => `${t.pa.chain[c.key]}: ${t.pa.state[c.state]}`).join(" → ")}`, "");
  }
  for (const s of text.sections) {
    if (!s.paragraphs.length) continue;
    lines.push(`## ${s.title}`, "");
    for (const p of s.paragraphs) lines.push(`${s.key === "questions" ? "- " : ""}${p.text}${p.claimIds.length ? " " + p.claimIds.map(chip).join(" ") : ""}`, s.key === "questions" ? "" : "");
  }
  lines.push(`## ${t.report.appendix}`, "", `| ${t.report.colClaim} | ${t.report.colStatus} | ${t.report.colValue} | ${t.report.colMeaning} | ${de ? "Zeitraum" : "Period"} | ${t.report.colEvidence} | ${t.report.colQuote} |`, "|---|---|---|---|---|---|---|");
  for (const c of r.claimsSnapshot) {
    const v = claimView(c, lang);
    lines.push(`| ${c.id} | ${STATUS_L[lang][c.status]} | ${fmt(c.value)} ${c.value === null ? "" : v.unit} | ${v.label} | ${c.period} | ${c.evidenceId} | ${c.quote.replace(/\|/g, "/")} |`);
  }
  lines.push(
    "",
    `## ${t.stamp.title} (${t.stamp.subtitle})`,
    "",
    `- ${t.stamp.preparedBy}: ${r.preparedBy ?? "—"}`,
    `- ${t.stamp.approvedBy}: ${r.review?.decision === "approve" ? `${r.review.reviewer} · ${r.review.at.slice(0, 16).replace("T", " ")}` : t.stamp.pending}`,
    `- ${t.stamp.fingerprint}: ${r.review?.fingerprint ?? "—"}`,
  );
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="schmitz-stiftungen-c08-report-v${r.version ?? 1}-${lang}.md"` },
  });
}
