import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ─── Brand Profile ─────────────────────────────────────────────────────────────

export const brandProfileSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(1, "Brand name is required"),
  description: z.string().optional(),
  audienceDesc: z.string().optional(),
  voiceGuidance: z.string().optional(),
  styleKeywords: z.array(z.string()).default([]),
  bannedPhrases: z.array(z.string()).default([]),
  bannedClaims: z.array(z.string()).default([]),
  ctaPreferences: z.string().optional(),
  visualStyle: z.string().optional(),
  colorReferences: z.array(z.string()).default([]),
  referenceUrls: z.array(z.string().url()).default([]),
  negativePrompts: z.array(z.string()).default([]),
});

export type BrandProfileInput = z.infer<typeof brandProfileSchema>;

// ─── Content Source ────────────────────────────────────────────────────────────

export const contentSourceSchema = z.object({
  sourceType: z.enum([
    "topic",
    "note",
    "product_update",
    "launch_update",
    "promo_offer",
    "url",
    "upload",
    "brief",
    "draft_duplication",
  ]),
  rawContent: z.string().optional(),
  url: z.string().url().optional(),
});

export type ContentSourceInput = z.infer<typeof contentSourceSchema>;

// ─── Content Generation ───────────────────────────────────────────────────────

const generateBaseSchema = z.object({
  brandId: z.string().cuid("Invalid brand ID").optional(),
  contentType: z.enum(["FEED_POST", "CAROUSEL", "REEL", "STORY"]).optional(),
  sourceContent: z.string().max(5000).optional(),
  sourceType: z.enum([
    "topic",
    "note",
    "product_update",
    "launch_update",
    "promo_offer",
    "url",
    "upload",
    "brief",
    "draft_duplication",
  ]).optional(),
  tone: z.enum([
    "PROFESSIONAL",
    "CASUAL",
    "BOLD",
    "SAFE",
    "PREMIUM",
    "PLAYFUL",
    "EMPOWERING",
    "MINIMAL",
  ]).default("CASUAL").optional(),
  generateVisuals: z.boolean().default(false).optional(),
  referenceImageUrls: z.array(z.string().url()).default([]).optional(),
  regenerateFromDraftId: z.string().cuid().optional(),
});

export const generateContentSchema = generateBaseSchema;

// ─── Image Generation ──────────────────────────────────────────────────────────

export const imageGenerationSchema = z.object({
  draftId: z.string().cuid().optional(),
  draftSectionId: z.string().cuid().optional(),
  prompt: z.string().min(1, "Prompt is required").max(2000),
  negativePrompt: z.string().max(1000).optional(),
  width: z.number().min(256).max(2048).default(1024),
  height: z.number().min(256).max(2048).default(1024),
  style: z.string().optional(),
  seed: z.number().optional(),
  referenceImageUrl: z.string().url().optional(),
  referenceImageStrength: z.number().min(0).max(1).optional(),
});

export type ImageGenerationInput = z.infer<typeof imageGenerationSchema>;

// ─── Draft Editing ────────────────────────────────────────────────────────────

export const createDraftSchema = z.object({
  workspaceId: z.string().cuid(),
  brandId: z.string().cuid(),
  contentType: z.enum(["FEED_POST", "CAROUSEL", "REEL", "STORY"]),
  caption: z.string().optional(),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  altText: z.string().optional(),
  tone: z.enum(["PROFESSIONAL", "CASUAL", "BOLD", "SAFE", "PREMIUM", "PLAYFUL", "EMPOWERING", "MINIMAL"]).optional(),
  meta: z.record(z.any()).optional(),
});

export type CreateDraftInput = z.infer<typeof createDraftSchema>;

export const updateDraftSchema = z.object({
  caption: z.string().max(2200).optional(),
  cta: z.string().max(100).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  altText: z.string().max(500).optional(),
  reelHook: z.string().max(150).optional(),
  reelScript: z.string().max(2200).optional(),
  reelShotList: z.array(z.string()).optional(),
  reelCaption: z.string().max(2200).optional(),
  storyFrames: z.array(z.object({
    frameNumber: z.number(),
    copy: z.string().max(500),
    stickerSuggestions: z.array(z.string()).optional(),
    cta: z.string().optional(),
    visualPrompt: z.string().optional(),
    imageAssetId: z.string().optional(),
  })).optional(),
  tone: z.enum([
    "PROFESSIONAL",
    "CASUAL",
    "BOLD",
    "SAFE",
    "PREMIUM",
    "PLAYFUL",
    "EMPOWERING",
    "MINIMAL",
  ]).optional(),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]).optional(),
});

export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

// ─── Scheduling ────────────────────────────────────────────────────────────────

export const schedulePostSchema = z.object({
  draftId: z.string().cuid("Invalid draft ID"),
  scheduledAt: z.string().datetime().refine(
    (d) => new Date(d) > new Date(),
    "Scheduled time must be in the future"
  ),
});

export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

// ─── Section Regeneration ─────────────────────────────────────────────────────

export const regenerateSectionSchema = z.object({
  draftId: z.string().cuid("Invalid draft ID"),
  sectionType: z.enum([
    "CAPTION",
    "HOOK",
    "BODY",
    "CTA",
    "HASHTAGS",
    "SLIDE_TEXT",
    "FRAME_COPY",
    "SCRIPT",
    "SHOT_LIST",
    "THUMBNAIL_IDEA",
    "VISUAL_PROMPT",
  ]),
  instruction: z.string().min(1).max(500).optional(),
  tone: z.enum([
    "PROFESSIONAL",
    "CASUAL",
    "BOLD",
    "SAFE",
    "PREMIUM",
    "PLAYFUL",
    "EMPOWERING",
    "MINIMAL",
  ]).optional(),
});

export type RegenerateSectionInput = z.infer<typeof regenerateSectionSchema>;

// ─── URL Fetching ─────────────────────────────────────────────────────────────

export const fetchUrlSchema = z.object({
  url: z.string().url("Invalid URL"),
});

export type FetchUrlInput = z.infer<typeof fetchUrlSchema>;
