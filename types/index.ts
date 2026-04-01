// ─── All types and enums in one file ─────────────────────────────────────────
// This avoids circular import issues between enums and domain types.

export type Platform = "INSTAGRAM";
export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL";
export type AssetSource = "UPLOAD" | "GENERATED" | "INSTAGRAM" | "URL";
export type ContentType = "FEED_POST" | "CAROUSEL" | "REEL" | "STORY";
export type DraftStatus = "DRAFT" | "READY" | "PUBLISHED" | "ARCHIVED";
export type PublishStatus = "PENDING" | "PROCESSING" | "PUBLISHED" | "FAILED" | "SCHEDULED";
export type TonePreset = "PROFESSIONAL" | "CASUAL" | "BOLD" | "SAFE" | "PREMIUM" | "PLAYFUL" | "EMPOWERING" | "MINIMAL";
export type InsightType = "TOP_HOOK" | "TOP_CTA" | "TOP_FORMAT" | "CONTENT_GAP" | "POST_READINESS" | "BRAND_ALIGNMENT" | "DUPLICATE_WARNING" | "MISSING_MEDIA" | "WEAK_HOOK" | "OVERLENGTH" | "VISUAL_MISMATCH";
export type SectionType = "CAPTION" | "HOOK" | "BODY" | "CTA" | "HASHTAGS" | "SLIDE_TEXT" | "FRAME_COPY" | "SCRIPT" | "SHOT_LIST" | "THUMBNAIL_IDEA" | "VISUAL_PROMPT";
export type AccountStatus = "ACTIVE" | "RATE_LIMITED" | "DISCONNECTED" | "PENDING_REVIEW" | "UNSUPPORTED_ACCOUNT_TYPE";
export type ImageJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type SourceType = "topic" | "note" | "product_update" | "launch_update" | "promo_offer" | "url" | "upload" | "brief" | "draft_duplication";

// ─── Brand ───────────────────────────────────────────────────────────────────

export interface BrandProfile {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  audienceDesc?: string;
  voiceGuidance?: string;
  styleKeywords: string[];
  bannedPhrases: string[];
  bannedClaims: string[];
  ctaPreferences?: string;
  visualStyle?: string;
  colorReferences: string[];
  referenceUrls: string[];
  negativePrompts: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Draft ───────────────────────────────────────────────────────────────────

export interface Draft {
  id: string;
  workspaceId: string;
  brandId: string;
  sourceId?: string;
  contentType: ContentType;
  status: DraftStatus;
  tone: TonePreset;
  caption?: string;
  captionVariants?: string[];
  cta?: string;
  hashtags?: string[];
  altText?: string;
  reelHook?: string;
  reelScript?: string;
  reelShotList?: string[];
  reelCaption?: string;
  storyFrames?: StoryFrame[];
  readinessScore?: number;
  brandScore?: number;
  completenessScore?: number;
  duplicateFlag: boolean;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  // Relations (populated when fetched with include)
  sections?: DraftSection[];
  variants?: DraftVariant[];
  mediaAssets?: DraftMediaEntry[];
  insights?: ContentInsight[];
  brand?: BrandProfile;
}

export interface DraftVariant {
  id: string;
  draftId: string;
  name: string;
  isSelected: boolean;
  data: ContentVariantData;
  createdAt: Date;
}

export interface ContentVariantData {
  caption?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  slideTexts?: string[];
  frameCopies?: string[];
  visualPrompts?: string[];
}

export interface DraftSection {
  id: string;
  draftId: string;
  sectionType: SectionType;
  sortOrder: number;
  content?: string;
  promptUsed?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftMediaEntry {
  draftId: string;
  assetId: string;
  isPrimary: boolean;
  sortOrder: number;
  asset?: MediaAsset;
}

export interface StoryFrame {
  frameNumber: number;
  copy: string;
  stickerSuggestions?: string[];
  cta?: string;
  visualPrompt?: string;
  imageAssetId?: string;
}

// ─── Media ───────────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: string;
  workspaceId: string;
  draftId?: string;
  instagramId?: string;
  assetSource: AssetSource;
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  altText?: string;
  promptVersionId?: string;
  meta?: ImageAssetMeta;
  createdAt: Date;
}

export interface ImageAssetMeta {
  prompt?: string;
  model?: string;
  style?: string;
  seed?: string;
  steps?: number;
  dimensions?: { width: number; height: number };
}

// ─── Content Generation ───────────────────────────────────────────────────────

export interface ContentGenerationRequest {
  brandId: string;
  contentType: ContentType;
  sourceContent: string;
  sourceType: string;
  tone: TonePreset;
  generateVisuals: boolean;
  referenceImageUrls?: string[];
}

export interface ContentGenerationResult {
  variants: GeneratedVariant[];
  imagePrompts: GeneratedImagePrompt[];
}

export interface GeneratedVariant {
  name: string;
  caption?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  slideTexts?: string[];
  frameCopies?: string[];
  visualPrompts?: string[];
  thumbnailIdea?: string;
  script?: string;
  shotList?: string[];
}

export interface GeneratedImagePrompt {
  index: number;
  sectionType: string;
  prompt: string;
  concept: string;
}

export interface ImageGenerationRequest {
  draftId?: string;
  draftSectionId?: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string;
  referenceImageUrl?: string;
  referenceImageStrength?: number;
}

// ─── Publishing ──────────────────────────────────────────────────────────────

export interface ScheduleRequest {
  draftId: string;
  scheduledAt: Date;
}

export interface PublishResult {
  success: boolean;
  instagramId?: string;
  permalink?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSnapshot {
  id: string;
  socialAccountId: string;
  workspaceId: string;
  instagramMediaId: string;
  igShortCode: string;
  postUrl: string;
  postType: ContentType;
  caption?: string;
  publishedAt?: Date;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
  impressions?: number;
  reach?: number;
  plays?: number;
  followerCount?: number;
  syncedAt: Date;
}

export interface AnalyticsSummary {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  avgEngagement: number;
  topPosts: AnalyticsSnapshot[];
  topFormat: ContentType | null;
  topHookPattern: string | null;
  topCtaPattern: string | null;
  aiSummary: string;
}

// ─── Content Insights ─────────────────────────────────────────────────────────

export interface ContentInsight {
  id: string;
  draftId: string;
  insightType: InsightType;
  severity: "info" | "warning" | "critical";
  message: string;
  data?: Record<string, unknown>;
}

// ─── Ollama ──────────────────────────────────────────────────────────────────

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  format?: "json" | "";
  options?: Record<string, unknown>;
  stream?: boolean;
  /** Set to true to disable chain-of-thought reasoning on thinking models (e.g. nemotron). */
  disableThinking?: boolean;
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  totalDuration?: number;
  context?: number[];
}

export interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

// ─── Instagram ───────────────────────────────────────────────────────────────

export interface InstagramAccount {
  id: string;
  instagramId: string;
  username: string;
  displayName?: string;
  profileImageUrl?: string;
  isProfessional: boolean;
  accountStatus: AccountStatus;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  likeCount?: number;
  commentsCount?: number;
  reach?: number;
  impressions?: number;
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

export interface ScheduledPost {
  id: string;
  draftId: string;
  scheduledAt: Date;
  publishStatus: PublishStatus;
  instagramId?: string;
  permalink?: string;
  retryCount: number;
  lastError?: string;
}

// ─── Session / Auth ───────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  workspaceId: string;
  instagramConnected: boolean;
}
