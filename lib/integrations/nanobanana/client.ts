import type {
  NanoBananaConfig,
  NanoBananaGenerateRequest,
  NanoBananaGenerateResponse,
  NanoBananaEditRequest,
  NanoBananaEditResponse,
  NanoBananaVariantsRequest,
  NanoBananaVariantsResponse,
  NanoBananaHealthResult,
} from "./types";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class NanoBananaError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerMessage?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NanoBananaError";
  }
}

export class NanoBananaTimeoutError extends NanoBananaError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, undefined, undefined, undefined);
    this.name = "NanoBananaTimeoutError";
  }
}

export class NanoBananaAuthError extends NanoBananaError {
  constructor(message = "Invalid or missing API key") {
    super(message, 401);
    this.name = "NanoBananaAuthError";
  }
}

export class NanoBananaQuotaError extends NanoBananaError {
  constructor(message = "Quota exceeded") {
    super(message, 429);
    this.name = "NanoBananaQuotaError";
  }
}

// ─── NanoBananaClient ──────────────────────────────────────────────────────────

export class NanoBananaClient {
  private readonly timeoutMs: number;

  constructor(private readonly config: NanoBananaConfig) {
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Validates the API key by hitting a lightweight endpoint.
   */
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.get<{ ok?: boolean }>("/health");
      return { valid: true };
    } catch (err) {
      if (err instanceof NanoBananaAuthError) {
        return { valid: false, error: "Invalid API key" };
      }
      return {
        valid: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Health check – probes /account or /health for quota and status info.
   */
  async healthCheck(): Promise<NanoBananaHealthResult> {
    try {
      // Try /account first – most providers expose quota there
      const account = await this.get<{
        quotaRemaining?: number;
        quotaUsed?: number;
      }>("/account");

      return {
        ok: true,
        quotaRemaining: account.quotaRemaining,
        quotaUsed: account.quotaUsed,
      };
    } catch (err) {
      // Fallback to /health
      try {
        await this.get<{ ok?: boolean }>("/health");
        return { ok: true };
      } catch (fallbackErr) {
        return {
          ok: false,
          error:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : "Health check failed",
        };
      }
    }
  }

  /**
   * Text-to-image generation.
   */
  async generateImage(
    req: NanoBananaGenerateRequest,
  ): Promise<NanoBananaGenerateResponse> {
    const body = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      width: req.width ?? 1024,
      height: req.height ?? 1024,
      style: req.style,
      seed: req.seed,
      num_images: req.numImages ?? 1,
      reference_image_url: req.referenceImageUrl,
      reference_image_strength: req.referenceImageStrength,
    };

    const data = await this.post<NanoBananaGenerateResponse>(
      "/images/generate",
      body,
    );
    return data;
  }

  /**
   * Image editing / inpainting.
   */
  async editImage(req: NanoBananaEditRequest): Promise<NanoBananaEditResponse> {
    const body = {
      prompt: req.prompt,
      original_image_url: req.originalImageUrl,
      mask_image_url: req.maskImageUrl,
      strength: req.strength,
      width: req.width,
      height: req.height,
    };

    const data = await this.post<NanoBananaEditResponse>("/images/edit", body);
    return data;
  }

  /**
   * Create variations of an existing image.
   */
  async createVariants(
    req: NanoBananaVariantsRequest,
  ): Promise<NanoBananaVariantsResponse> {
    const body = {
      image_url: req.imageUrl,
      prompt: req.prompt,
      num_variants: req.numVariants ?? 2,
      width: req.width,
      height: req.height,
    };

    const data = await this.post<NanoBananaVariantsResponse>(
      "/images/variations",
      body,
    );
    return data;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.fetchWithRetry<T>(endpoint, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });
  }

  private async get<T>(endpoint: string): Promise<T> {
    return this.fetchWithRetry<T>(endpoint, {
      method: "GET",
      headers: this.buildHeaders(),
    });
  }

  private async fetchWithRetry<T>(
    endpoint: string,
    init: RequestInit,
    retries = 2,
  ): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}${endpoint}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        this.timeoutMs,
      );

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Map HTTP status to typed errors
        if (response.status === 401) {
          throw new NanoBananaAuthError();
        }
        if (response.status === 429) {
          const body = await response.json().catch(() => ({}));
          throw new NanoBananaQuotaError(
            (body as { message?: string }).message ?? "Quota exceeded",
          );
        }
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new NanoBananaError(
            `Nano Banana API error ${response.status}: ${body}`,
            response.status,
          );
        }

        const json = await response.json();
        return json as T;
      } catch (err) {
        clearTimeout(timer);

        // Don't retry timeouts, auth errors, or quota errors
        if (
          err instanceof NanoBananaTimeoutError ||
          err instanceof NanoBananaAuthError ||
          err instanceof NanoBananaQuotaError
        ) {
          throw err;
        }

        // Don't retry on last attempt
        if (attempt >= retries) {
          if (err instanceof NanoBananaError) throw err;
          throw new NanoBananaError(
            err instanceof Error ? err.message : String(err),
            undefined,
            undefined,
            err,
          );
        }

        // Exponential backoff for network failures
        const delay = 200 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
        lastError = err;
      }
    }

    throw lastError;
  }
}
