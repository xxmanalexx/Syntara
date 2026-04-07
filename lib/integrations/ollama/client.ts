import { z } from "zod";
import type {
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaEmbeddingRequest,
  OllamaEmbeddingResponse,
} from "@/types";

// ─── Error types ─────────────────────────────────────────────────────────────

export class OllamaTimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = "OllamaTimeoutError";
  }
}

export class OllamaNetworkError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "OllamaNetworkError";
  }
}

export class OllamaParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
  ) {
    super(message);
    this.name = "OllamaParseError";
  }
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 600_000, ...fetchOptions } = options; // 10 min default
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OllamaNetworkError(
        `HTTP ${response.status}`,
        response.status,
      );
    }

    const data = await response.json();
    return data as T;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OllamaTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Ollama Client ────────────────────────────────────────────────────────────

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly baseHeaders: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl?: string; apiKey?: string } | string = {}) {
    const opts = typeof options === "string" ? { baseUrl: options } : options;
    this.baseUrl =
      opts.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    this.baseHeaders = opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {};
    this.timeoutMs = 120_000;
  }

  // ─── Health check ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ ok: boolean; models: string[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false, models: [] };
      const data = (await res.json()) as { models?: { name: string }[] };
      return { ok: true, models: (data.models ?? []).map((m) => m.name) };
    } catch {
      return { ok: false, models: [] };
    }
  }

  /**
   * Raw text generation.
   */
  async generate(opts: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const body: Record<string, unknown> = { stream: false, ...opts };
    if (opts.disableThinking) {
      body.think = false;
    }
    const response = await fetchWithRetry<OllamaGenerateResponse>(
      `${this.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify(body),
        timeoutMs: this.timeoutMs,
      },
    );
    return response;
  }

  /**
   * Structured JSON generation. Uses streaming internally to accumulate all
   * chunks from Ollama (which always streams, even with stream:false in the
   * body). Parses JSON from chunk.response or chunk.thinking fields.
   */
  async generateJSON<T extends z.ZodType>(
    opts: OllamaGenerateRequest,
    schema: T,
    maxRetries = 1,
  ): Promise<z.infer<T>> {
    const jsonOpts = { ...opts, disableThinking: true };

    const attemptGenerate = async (retryHint?: string): Promise<Record<string, unknown>> => {
      const promptWithHint = jsonOpts.prompt + (retryHint ?? "");

      // Ollama streams: JSON arrives in chunk.response; reasoning goes in chunk.thinking.
      // Must accumulate both fields across all chunks.
      let lastChunk: OllamaGenerateResponse | null = null;
      let responseText = "";
      let thinkingText = "";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000);

      try {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers: this.baseHeaders,
          body: JSON.stringify({ stream: true, ...jsonOpts, prompt: promptWithHint, format: "json" }),
          signal: controller.signal,
        });
        if (!response.ok) throw new OllamaNetworkError(`HTTP ${response.status}`, response.status);
        if (!response.body) throw new OllamaNetworkError("Response body is null");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as OllamaGenerateResponse;
              lastChunk = chunk;
              if (chunk.response) responseText += chunk.response;
              if (chunk.thinking) thinkingText += chunk.thinking;
            } catch {
              // Skip malformed lines
            }
          }
        }
      } finally {
        clearTimeout(timer);
      }

      console.log(
        `[Ollama generateJSON] response.len=${responseText.length} thinking.len=${thinkingText.length} done=${lastChunk?.done}`,
      );
      console.log(`[Ollama generateJSON] response=${JSON.stringify(responseText.slice(0, 300))}`);
      console.log(`[Ollama generateJSON] thinking=${JSON.stringify(thinkingText.slice(0, 500))}`);

      const stripFences = (t: string) =>
        t.replace(/^[\s\n]*```json[\s\n]*/im, "").replace(/```[\s\n]*$/im, "").replace(/`/g, "").trim();

      const cleanResponse = stripFences(responseText);
      const cleanThinking = stripFences(thinkingText);

      // Strategy 1: clean response starts with { → direct parse
      if (cleanResponse.startsWith("{")) {
        try {
          const parsed = JSON.parse(cleanResponse);
          console.log(`[Ollama generateJSON] ✓ direct parse of response`);
          return parsed;
        } catch { /* fall through */ }
      }

      // Strategy 2: extract {...} from responseText via greedy match
      const respMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (respMatch) {
        try {
          JSON.parse(respMatch[0]);
          console.log(`[Ollama generateJSON] ✓ parsed via regex from response`);
          return JSON.parse(respMatch[0]);
        } catch { /* fall through */ }
      }

      // Strategy 3: extract {...} from thinkingText
      const thinkMatch = cleanThinking.match(/\{[\s\S]*?\}/);
      console.log(`[Ollama generateJSON] thinkMatch=${JSON.stringify(thinkMatch?.[0]?.slice(0, 200))}`);
      if (thinkMatch) {
        try {
          JSON.parse(thinkMatch[0]);
          console.log(`[Ollama generateJSON] ✓ parsed from thinking`);
          return JSON.parse(thinkMatch[0]);
        } catch (err) {
          console.log(`[Ollama generateJSON] thinking parse failed: ${(err as Error).message}`);
        }
      }

      throw new OllamaParseError(`Not JSON: ${cleanResponse.slice(0, 80)}`, cleanResponse);
    };

    const coerce = (json: Record<string, unknown>): Record<string, unknown> => ({
      ...json,
      reply: json.reply ?? json.suggested_reply ?? json.message ?? undefined,
      suggested_reply: json.suggested_reply ?? json.reply ?? undefined,
    });

    for (let i = 0; i <= maxRetries; i++) {
      const hint =
        i > 0 ? "\n\nIMPORTANT: Reply with ONLY valid JSON, no markdown fences." : undefined;
      try {
        const rawJson = await attemptGenerate(hint);
        const coerced = coerce(rawJson);
        console.log(`[Ollama generateJSON] attempt=${i} coerced=${JSON.stringify(coerced).slice(0, 200)}`);

        if (Object.keys(coerced).length === 0) {
          throw new OllamaParseError("Empty JSON response from model", JSON.stringify(coerced));
        }

        const safe = schema.safeParse(coerced);
        console.log(`[Ollama generateJSON] attempt=${i} safe.success=${safe.success} safe.data=${safe.success ? JSON.stringify(safe.data).slice(0, 200) : 'N/A'}`);
        if (safe.success) {
          console.log(`[Ollama generateJSON] ✓ returning: ${JSON.stringify(safe.data).slice(0, 200)}`);
          return safe.data;
        }
        // Schema validation failed — extract error message safely
        const errMsg = safe.error && typeof safe.error === "object" && "issues" in safe.error
          ? (Array.isArray((safe.error as any).issues) ? ((safe.error as any).issues[0]?.message ?? String(safe.error)) : String(safe.error))
          : String(safe.error ?? "unknown");
        throw new OllamaParseError(`Schema mismatch: ${errMsg}`, JSON.stringify(coerced));
      } catch (rawErr) {
        const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
        const isNonRetryable = err instanceof OllamaTimeoutError || err instanceof OllamaNetworkError;
        console.log(`[Ollama generateJSON] attempt=${i} caught="${err.message}" isNonRetryable=${isNonRetryable}`);
        if (isNonRetryable) throw err;
        // OllamaParseError or unknown → retry
      }
    }

    // Last resort
    const parsed = schema.safeParse({});
    console.log(`[Ollama generateJSON] last resort parsed=${JSON.stringify(parsed.data).slice(0, 200)} success=${parsed.success}`);
    if (parsed.success) return parsed.data;
    throw new OllamaParseError("All retries exhausted", "");
  }

  /**
   * Streaming text generation. Yields each chunk.
   */
  async *generateStream(
    opts: OllamaGenerateRequest,
  ): AsyncGenerator<OllamaGenerateResponse & { done: false }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify({ stream: true, ...opts }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OllamaNetworkError(`HTTP ${response.status}`, response.status);
      }

      if (!response.body) {
        throw new OllamaNetworkError("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as OllamaGenerateResponse;
              yield chunk as OllamaGenerateResponse & { done: false };
              if (chunk.done) return;
            } catch {
              // Skip malformed lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Text embeddings.
   */
  async embeddings(opts: OllamaEmbeddingRequest): Promise<OllamaEmbeddingResponse> {
    return fetchWithRetry<OllamaEmbeddingResponse>(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: this.baseHeaders,
      body: JSON.stringify(opts),
      timeoutMs: this.timeoutMs,
    });
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const ollamaClient = new OllamaClient();
