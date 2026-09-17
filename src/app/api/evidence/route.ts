import { z } from "zod";
import { addFiles } from "@/lib/actions";
import { joinHits, personalDataHits } from "@/lib/engine/synthetic-guard";
import { langOf, msg } from "@/lib/i18n/server";
import type { Lang } from "@/lib/i18n/core";

export const runtime = "nodejs";

const Pasted = z.object({ name: z.string().trim().min(1).max(80), text: z.string().trim().min(3).max(20000), synthetic: z.literal(true).optional() });

function screen(name: string, text: string, lang: Lang) {
  const hits = personalDataHits(text);
  return hits.length ? msg("personalData", lang, { name, hits: joinHits(hits) }) : null;
}

const bad = (error: string) => Response.json({ error }, { status: 400 });

/** multipart (fichiers) ou JSON (texte collé) — matériel d'exercice synthétique uniquement. */
export async function POST(req: Request) {
  const lang = langOf(req);
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      if (form.get("synthetic") !== "yes") return bad(msg("syntheticConfirm", lang));
      const files: { name: string; text: string }[] = [];
      for (const v of form.getAll("files")) {
        if (typeof v === "string") continue;
        if (v.size > 2_000_000) return bad(msg("fileTooLarge", lang, { name: v.name }));
        if (!/\.(json|txt|md|csv)$/i.test(v.name)) return bad(msg("fileType", lang, { name: v.name }));
        const text = await v.text();
        const hit = screen(v.name, text, lang);
        if (hit) return bad(hit);
        files.push({ name: v.name, text });
      }
      const added = await addFiles(files, "uploaded");
      return Response.json({ added });
    }
    const p = Pasted.safeParse(await req.json().catch(() => null));
    if (!p.success) return bad(msg("pasteInvalid", lang));
    if (!p.data.synthetic) return bad(msg("syntheticConfirm", lang));
    const hit = screen(p.data.name, p.data.text, lang);
    if (hit) return bad(hit);
    const added = await addFiles([{ name: p.data.name, text: p.data.text }], "pasted");
    return Response.json({ added });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
