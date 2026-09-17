import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config";

let client: OpenAI | null = null;
function deepseek(): OpenAI {
  if (!config.deepseekApiKey) throw new Error("DEEPSEEK_API_KEY is missing in .env.local");
  client ??= new OpenAI({ apiKey: config.deepseekApiKey, baseURL: config.baseUrl, timeout: config.llmTimeoutMs, maxRetries: 2 });
  return client;
}

export interface LlmUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
  ms: number;
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start < 0) throw new SyntaxError("no JSON object");
  // premier objet JSON complet (ignore le texte après)
  let depth = 0;
  let inStr = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
  }
  throw new SyntaxError("unterminated JSON");
}

/**
 * Appel qui DOIT renvoyer un JSON conforme au schéma.
 * Une nouvelle tentative avec l'erreur ; sinon exception (l'appelant a un repli déterministe).
 * Les modèles DeepSeek raisonnent avant de répondre : le budget de jetons est large.
 */
export async function chatJSON<S extends z.ZodTypeAny>(opts: {
  model: string;
  system?: string;
  user: string;
  schema: S;
  maxTokens?: number;
  temperature?: number;
  thinking?: boolean;
}): Promise<{ data: z.infer<S>; usage: LlmUsage }> {
  let feedback = "";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    try {
      const body = {
        model: opts.model,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 6000,
        response_format: { type: "json_object" as const },
        messages: [
          ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
          { role: "user" as const, content: opts.user + feedback },
        ],
        // DeepSeek : réflexion désactivée par défaut → ~1 s par appel (la sécurité vient du harnais)
        thinking: { type: opts.thinking ? "enabled" : "disabled" },
      };
      const res = await deepseek().chat.completions.create(body as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming);
      const raw = res.choices[0]?.message?.content ?? "";
      const parsed = opts.schema.safeParse(extractJson(raw));
      const usage = {
        model: opts.model,
        tokensIn: res.usage?.prompt_tokens ?? 0,
        tokensOut: res.usage?.completion_tokens ?? 0,
        ms: Date.now() - t0,
      };
      if (parsed.success) return { data: parsed.data, usage };
      lastErr = parsed.error;
      feedback = `\n\nYour previous answer did not match the JSON schema: ${parsed.error.message.slice(0, 300)}. Return valid JSON only.`;
    } catch (err) {
      lastErr = err;
      if (!(err instanceof SyntaxError)) break;
      feedback = "\n\nReturn one valid JSON object only.";
    }
  }
  throw new Error(`LLM call failed (${opts.model}): ${String(lastErr).slice(0, 200)}`);
}
