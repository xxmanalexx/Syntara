// ─── Provider-agnostic asset metadata ────────────────────────────────────────

export interface ImageAssetMetadata {
  provider: string;
  providerJobId?: string;
  prompt: string;
  normalizedPrompt?: string;
  model?: string;
  style?: string;
  seed?: string;
  steps?: number;
  dimensions?: { width: number; height: number };
  format?: string;
  cost?: number;
  processingTimeMs?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface NanoBananaConfig {
  apiKey: string;
  baseUrl: string; // e.g. "https://api.nanobanana.io/v1"
  timeoutMs?: number;
}

// ─── Request types ────────────────────────────────────────────────────────────

export interface NanoBananaGenerateRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number; // default 1024
  height?: number; // default 1024
  style?: string; // e.g. "photorealistic", "illustration", "cinematic"
  seed?: number;
  numImages?: number; // default 1, max 4
  referenceImageUrl?: string;
  referenceImageStrength?: number; // 0-1, for img2img
}

export interface NanoBananaEditRequest {
  prompt: string;
  maskImageUrl?: string; // URL to mask area to edit
  originalImageUrl: string;
  strength?: number; // 0-1
  width?: number;
  height?: number;
}

export interface NanoBananaVariantsRequest {
  imageUrl: string;
  prompt?: string; // optional variation direction
  numVariants?: number; // default 2
  width?: number;
  height?: number;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface NanoBananaImage {
  url: string;
  revisedPrompt?: string;
  dimensions?: { width: number; height: number };
  seed?: number;
  finishReason?: string;
}

export interface NanoBananaGenerateResponse {
  images: NanoBananaImage[];
  jobId: string;
  processingTimeMs?: number;
}

export interface NanoBananaEditResponse {
  image: NanoBananaImage;
  jobId: string;
  processingTimeMs?: number;
}

export interface NanoBananaVariantsResponse {
  images: NanoBananaImage[];
  jobId: string;
}

// ─── Health check ─────────────────────────────────────────────────────────────

export interface NanoBananaHealthResult {
  ok: boolean;
  quotaRemaining?: number;
  quotaUsed?: number;
  error?: string;
}
