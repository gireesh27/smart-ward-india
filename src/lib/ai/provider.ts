import { env } from "../env";
import { AppError } from "../errors";
import { log } from "../logger";

/**
 * One interface over three kinds of LLM endpoint:
 *  - ollama:    local models, free, nothing leaves the machine (default for local use)
 *  - openai:    OpenAI or any OpenAI-compatible server (Azure OpenAI, Groq, OpenRouter, vLLM, LM Studio…)
 *  - anthropic: Claude models
 * The platform works fully without any of them (AI_PROVIDER=none).
 */
export type AiProvider = "none" | "ollama" | "openai" | "anthropic";

export function aiConfig() {
  const e = env();
  const provider = (e.AI_PROVIDER || (e.AI_SUMMARY_PROVIDER === "anthropic" ? "anthropic" : "none")) as AiProvider;
  const model = e.AI_MODEL || e.AI_SUMMARY_MODEL || (provider === "ollama" ? "llama3.1:8b" : provider === "anthropic" ? "claude-haiku-5-5" : "");
  const baseUrl = (e.AI_BASE_URL || (provider === "ollama" ? "http://localhost:11434" : provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com")).replace(/\/$/, "");
  return { provider, model, baseUrl, apiKey: e.AI_API_KEY || e.AI_SUMMARY_API_KEY || "", timeoutMs: e.AI_TIMEOUT_MS };
}

export function aiStatus(): { available: boolean; provider: AiProvider; model: string; reason?: string } {
  const c = aiConfig();
  if (c.provider === "none") return { available: false, provider: c.provider, model: "", reason: "AI_PROVIDER is not set" };
  if (!c.model) return { available: false, provider: c.provider, model: "", reason: "AI_MODEL is required for this provider" };
  if (c.provider !== "ollama" && !c.apiKey) return { available: false, provider: c.provider, model: c.model, reason: "AI_API_KEY is not set" };
  return { available: true, provider: c.provider, model: c.model };
}

export async function complete(opts: { system: string; user: string; json?: boolean; maxTokens?: number }): Promise<{ text: string; provider: AiProvider; model: string }> {
  const status = aiStatus();
  if (!status.available) throw new AppError(501, "AI_NOT_CONFIGURED", `AI insights are not configured: ${status.reason}. See docs/AI.md.`);
  const c = aiConfig();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
  const maxTokens = opts.maxTokens ?? 1800;
  try {
    let res: Response;
    if (c.provider === "ollama") {
      res = await fetch(`${c.baseUrl}/api/chat`, {
        method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: c.model, stream: false, format: opts.json ? "json" : undefined, options: { temperature: 0.2, num_predict: maxTokens },
          messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }] }),
      });
    } else if (c.provider === "openai") {
      res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ model: c.model, temperature: 0.2, max_tokens: maxTokens, response_format: opts.json ? { type: "json_object" } : undefined,
          messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }] }),
      });
    } else {
      res = await fetch(`${c.baseUrl}/v1/messages`, {
        method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json", "x-api-key": c.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
      });
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      log.warn("ai.request_failed", { provider: c.provider, status: res.status, detail });
      throw new AppError(502, "AI_REQUEST_FAILED", `The ${c.provider} model returned an error (${res.status}). Check AI_MODEL and credentials.`);
    }
    type ProviderResponse = { message?: { content?: string }; choices?: Array<{ message?: { content?: string } }>; content?: Array<{ type: string; text?: string }> };
    const data = (await res.json()) as ProviderResponse;
    const text = c.provider === "ollama" ? data.message?.content
      : c.provider === "openai" ? data.choices?.[0]?.message?.content
      : data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (!text) throw new AppError(502, "AI_EMPTY", "The model returned an empty response.");
    return { text, provider: c.provider, model: c.model };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const aborted = (err as Error).name === "AbortError";
    log.warn("ai.unreachable", { provider: c.provider, err });
    throw new AppError(504, aborted ? "AI_TIMEOUT" : "AI_UNREACHABLE", aborted ? `The model did not respond within ${Math.round(c.timeoutMs / 1000)} s.` : `Could not reach the ${c.provider} endpoint at ${c.baseUrl}.`);
  } finally {
    clearTimeout(timer);
  }
}
