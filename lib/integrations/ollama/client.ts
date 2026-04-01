import { z } from "zod";
import type {
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaEmbeddingRequest,
  OllamaEmbeddingResponse,
} from "@/types";

// ─── Env ─────────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
const OLLAMA_TEXT_MODEL = process.env["OLLAMA_TEXT_MODEL"] ?? "llama3.2:latest";
const OLLAMA_REWRITE_MODEL = process.env["OLLAMA_REWRITE_MODEL"] ?? "llama3.2:latest";
const OLLAMA_SUMMARY_MODEL = process.env["OLLAMA_SUMMARY_MODEL"] ?? "llama3.2:latest";
const OLLAMA_EMBEDDINGS_MODEL =
  process.env["OLLAMA_EMBEDDINGS_MODEL"] ?? "nomic-embed-text:latest";

// ─── Defaults export ─────────────────────────────────────────────────────────

export const OLLAMA_DEFAULTS = {
  baseUrl: OLLAMA_BASE_URL,
  textModel: OLLAMA_TEXT_MODEL,
  rewriteModel: OLLAMA_REWRITE_MODEL,
  summaryModel: OLLAMA_SUMMARY_MODEL,
  embeddingsModel: OLLAMA_EMBEDDINGS_MODEL,
} as const;

// ─── Errors ───────────────────────────────────────────────────────────────────

export class OllamaNetworkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OllamaNetworkError";
  }
}

export class OllamaParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OllamaParseError";
  }
}

export class OllamaTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = "OllamaTimeoutError";
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OllamaTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions,
  retries = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new OllamaNetworkError(
          `HTTP ${response.status}: ${body}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err;

      // Don't retry on timeout or client errors
      if (
        err instanceof OllamaTimeoutError ||
        (err instanceof OllamaNetworkError && err.statusCode !== undefined && err.statusCode < 500)
      ) {
        throw err;
      }

      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ─── OllamaClient ─────────────────────────────────────────────────────────────

export class OllamaClient {
  constructor(
    private readonly baseUrl: string = OLLAMA_BASE_URL,
    private readonly defaultTimeoutMs: number = 30_000,
  ) {}

  private get baseHeaders(): HeadersInit {
    return { "Content-Type": "application/json" };
  }

  // ─── Health / Discovery ─────────────────────────────────────────────────────

  /**
   * Lightweight health check – hits /api/tags and reports which models are available.
   */
  async healthCheck(): Promise<{
    ok: boolean;
    models: string[];
    error?: string;
  }> {
    try {
      const data = await fetchWithRetry<{ models: { name: string }[] }>(
        `${this.baseUrl}/api/tags`,
        {
          method: "GET",
          headers: this.baseHeaders,
          timeoutMs: 5_000,
        },
        1,
      );
      return {
        ok: true,
        models: data.models.map((m) => m.name),
      };
    } catch (err) {
      return {
        ok: false,
        models: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Returns all available model names from the Ollama instance.
   */
  async listModels(): Promise<string[]> {
    const data = await fetchWithRetry<{ models: { name: string }[] }>(
      `${this.baseUrl}/api/tags`,
      {
        method: "GET",
        headers: this.baseHeaders,
        timeoutMs: this.defaultTimeoutMs,
      },
    );
    return data.models.map((m) => m.name);
  }

  // ─── Generate ───────────────────────────────────────────────────────────────

  /**
   * Raw text generation. Stream=false by default.
   */
  async generate(opts: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const response = await fetchWithRetry<OllamaGenerateResponse>(
      `${this.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify({ stream: false, ...opts }),
        timeoutMs: this.defaultTimeoutMs,
      },
    );
    return response;
  }

  /**
   * Structured JSON generation. Parses the model output as JSON and validates
   * it against the provided Zod schema. Retries up to `maxRetries` times on parse failure.
   */
  async generateJSON<T extends z.ZodType>(
    opts: OllamaGenerateRequest,
    schema: T,
    maxRetries = 2,
  ): Promise<z.infer<T>> {
    let lastError: OllamaParseError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const raw = await this.generate({ ...opts, format: "json" });

      try {
        const parsed = JSON.parse(raw.response);
        return schema.parse(parsed);
      } catch (err) {
        lastError = new OllamaParseError(
          `Failed to parse JSON (attempt ${attempt + 1}/${maxRetries + 1}): ${err instanceof Error ? err.message : String(err)}`,
          raw.response,
          err,
        );

        if (attempt < maxRetries) {
          // Add a修复 hint to the prompt for the next attempt
          const hint = `\n\nIMPORTANT: Your previous response was not valid JSON. Please respond with ONLY valid JSON, no additional text or markdown fences.`;
          const patched = {
            ...opts,
            prompt: opts.prompt + hint,
            format: "json" as const,
          };
          const retryRaw = await this.generate(patched);
          try {
            const parsed = JSON.parse(retryRaw.response);
            return schema.parse(parsed);
          } catch {
            // fall through to retry
          }
        }
      }
    }

    throw lastError!;
  }

  /**
   * Streaming text generation. Yields each chunk as a partial response.
   * The caller is responsible for assembling the final output.
   */
  async *generateStream(
    opts: OllamaGenerateRequest,
  ): AsyncGenerator<OllamaGenerateResponse & { done: false }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify({ stream: true, ...opts }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OllamaNetworkError(
          `HTTP ${response.status} during stream`,
          response.status,
        );
      }

      if (!response.body) {
        throw new OllamaNetworkError("Response body is null – streaming not supported");
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

  // ─── Embeddings ─────────────────────────────────────────────────────────────

  async embeddings(opts: OllamaEmbeddingRequest): Promise<OllamaEmbeddingResponse> {
    const response = await fetchWithRetry<OllamaEmbeddingResponse>(
      `${this.baseUrl}/api/embeddings`,
      {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify(opts),
        timeoutMs: this.defaultTimeoutMs,
      },
    );
    return response;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const ollamaClient = new OllamaClient();
