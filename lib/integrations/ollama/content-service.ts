import { z } from "zod";
import type { ContentType, TonePreset, SectionType } from "@/types";
import type { BrandProfile, OllamaGenerateRequest } from "@/types";
import { OllamaClient } from "./client";

// ─── Shared Zod schemas ───────────────────────────────────────────────────────

const VisualPromptSchema = z.object({
  index: z.number(),
  concept: z.string(),
  prompt: z.string(),
});

// ─── Feed Post Variants Schema ───────────────────────────────────────────────

const FeedPostVariantSchema = z.object({
  caption: z.string(),
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  altTextSuggestion: z.string(),
  visualConceptPrompts: z.array(z.string()).min(3).max(3),
});

const FeedPostVariantsResponseSchema = z.object({
  variants: z.array(FeedPostVariantSchema),
});

export type FeedPostVariant = z.infer<typeof FeedPostVariantSchema>;
export type FeedPostVariantsResponse = z.infer<typeof FeedPostVariantsResponseSchema>;

// ─── Carousel Schema ─────────────────────────────────────────────────────────

const SlideStructureSchema = z.object({
  slideNumber: z.number(),
  heading: z.string(),
  subtext: z.string().optional(),
});

const SlideCopySchema = z.object({
  slideNumber: z.number(),
  copy: z.string(),
  visualPrompt: z.string(),
});

const CarouselResponseSchema = z.object({
  conceptDirections: z.array(z.union([z.string(), z.object({ direction: z.string(), concept: z.string().optional() })])).min(3).max(3),
  coverHook: z.string(),
  slideStructure: z.array(SlideStructureSchema).min(5).max(10),
  slideCopy: z.array(SlideCopySchema),
  caption: z.string(),
  cta: z.string(),
  visualPrompts: z.array(z.union([z.string(), z.object({ prompt: z.string(), concept: z.string().optional() })])).default([]),
  coverImageConcept: z.string(),
  generatedSlideVisuals: z.array(z.string()).default([]),
}).transform((obj) => ({
  ...obj,
  // Normalize conceptDirections to flat strings
  conceptDirections: obj.conceptDirections.map((d) =>
    typeof d === "string" ? d : d.concept ?? d.direction ?? String(d)
  ),
  // Normalize visualPrompts to flat strings
  visualPrompts: obj.visualPrompts.map((v) =>
    typeof v === "string" ? v : v.prompt ?? v.concept ?? String(v)
  ),
}));

export type CarouselResponse = z.infer<typeof CarouselResponseSchema>;

// ─── Reel Schema ─────────────────────────────────────────────────────────────

const HookDirectionSchema = z.object({
  direction: z.string(),
  hookText: z.string(),
  whyItWorks: z.string().optional(),
});

const ReelResponseSchema = z.object({
  hookDirections: z.array(z.union([
    HookDirectionSchema,
    z.object({ direction: z.string(), hookText: z.string(), whyItWorks: z.string().optional() }),
  ])).min(3).max(3),
  scriptOrTalkingPoints: z.union([z.string(), z.array(z.string())]).default(""),
  shotList: z.array(z.union([z.string(), z.object({ shot: z.string(), description: z.string().optional() })])).default([]),
  visualStoryboard: z.union([z.string(), z.object({ description: z.string() })]).default(""),
  caption: z.string(),
  cta: z.string(),
  thumbnailCoverConcept: z.union([z.string(), z.object({ concept: z.string() })]).default(""),
}).transform((obj) => ({
  ...obj,
  scriptOrTalkingPoints: Array.isArray(obj.scriptOrTalkingPoints)
    ? obj.scriptOrTalkingPoints.join("\n")
    : obj.scriptOrTalkingPoints,
  shotList: obj.shotList.map((s) => typeof s === "string" ? s : s.shot ?? s.description ?? String(s)),
  visualStoryboard: typeof obj.visualStoryboard === "string" ? obj.visualStoryboard : obj.visualStoryboard.description ?? "",
  thumbnailCoverConcept: typeof obj.thumbnailCoverConcept === "string" ? obj.thumbnailCoverConcept : obj.thumbnailCoverConcept.concept ?? "",
}));

export type ReelResponse = z.infer<typeof ReelResponseSchema>;

// ─── Story Schema ─────────────────────────────────────────────────────────────

const FrameSequenceSchema = z.object({
  frameNumber: z.number(),
  concept: z.string(),
  visualPrompt: z.string(),
  stickerSuggestions: z.array(z.string()).optional(),
});

const FrameCopySchema = z.object({
  frameNumber: z.number(),
  copy: z.string(),
  cta: z.string().optional(),
});

const StoryResponseSchema = z.object({
  conceptDirections: z.array(z.union([z.string(), z.object({ direction: z.string(), concept: z.string().optional() })])).min(3).max(3),
  frameSequence: z.array(FrameSequenceSchema).min(3).max(5),
  frameByFrameCopy: z.array(FrameCopySchema),
  stickerSuggestions: z.array(z.string()),
  ctaProgression: z.union([z.array(z.string()), z.string()]).default([]),
  visualPrompts: z.array(z.union([z.string(), z.object({ prompt: z.string(), concept: z.string().optional() })])).default([]),
}).transform((obj) => ({
  ...obj,
  conceptDirections: obj.conceptDirections.map((d) =>
    typeof d === "string" ? d : d.concept ?? d.direction ?? String(d)
  ),
  ctaProgression: Array.isArray(obj.ctaProgression) ? obj.ctaProgression : [obj.ctaProgression],
  visualPrompts: obj.visualPrompts.map((v) =>
    typeof v === "string" ? v : v.prompt ?? v.concept ?? String(v)
  ),
}));

export type StoryResponse = z.infer<typeof StoryResponseSchema>;

// ─── Hashtag Schema ─────────────────────────────────────────────────────────

const HashtagsResponseSchema = z.object({
  hashtags: z.array(z.string()),
  categories: z.record(z.array(z.string())).optional(),
});

export type HashtagsResponse = z.infer<typeof HashtagsResponseSchema>;

// ─── Analytics Summary Schema ───────────────────────────────────────────────

const AnalyticsSummaryResponseSchema = z.object({
  summary: z.string(),
  keyHighlights: z.array(z.string()),
  recommendedActions: z.array(z.string()).optional(),
  topPerformingFormat: z.string().optional(),
  topPerformingHookType: z.string().optional(),
});

export type AnalyticsSummaryResponse = z.infer<typeof AnalyticsSummaryResponseSchema>;

// ─── Hook Effectiveness Schema ──────────────────────────────────────────────

const HookPatternSchema = z.object({
  pattern: z.string(),
  count: z.number(),
  avgEngagement: z.number(),
  exampleHooks: z.array(z.string()),
});

const HookEffectivenessResponseSchema = z.object({
  analysis: z.string(),
  patterns: z.array(HookPatternSchema),
  recommendations: z.array(z.string()),
  bestHooks: z.array(z.string()),
});

export type HookEffectivenessResponse = z.infer<typeof HookEffectivenessResponseSchema>;

// ─── Regenerate Section Schema ───────────────────────────────────────────────

const RegenerateSectionResponseSchema = z.object({
  sectionType: z.string(),
  newContent: z.string(),
  reasoning: z.string().optional(),
});

export type RegenerateSectionResponse = z.infer<typeof RegenerateSectionResponseSchema>;

// ─── Tone & ContentType labels ──────────────────────────────────────────────

const TONE_LABELS: Record<TonePreset, string> = {
  PROFESSIONAL: "Professional & polished",
  CASUAL: "Casual & conversational",
  BOLD: "Bold & attention-grabbing",
  SAFE: "Safe & family-friendly",
  PREMIUM: "Premium & luxurious",
  PLAYFUL: "Playful & fun",
  EMPOWERING: "Empowering & inspiring",
  MINIMAL: "Minimal & clean",
};

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  CAPTION: "caption",
  HOOK: "hook/opening line",
  BODY: "body copy",
  CTA: "call-to-action",
  HASHTAGS: "hashtags",
  SLIDE_TEXT: "slide text",
  FRAME_COPY: "story frame copy",
  SCRIPT: "reel script or talking points",
  SHOT_LIST: "shot list",
  THUMBNAIL_IDEA: "thumbnail idea",
  VISUAL_PROMPT: "visual generation prompt",
};

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(brand: BrandProfile, tone: TonePreset, task: string): string {
  const parts: string[] = [
    "You are an expert Instagram content strategist and copywriter.",
    `You are creating content EXCLUSIVELY for the brand: **${brand.name}**.`,
  ];

  if (brand.description) parts.push(`Brand description: ${brand.description}`);
  if (brand.audienceDesc) parts.push(`Target audience: ${brand.audienceDesc}`);
  if (brand.voiceGuidance) parts.push(`Brand voice guidance: ${brand.voiceGuidance}`);

  parts.push(`Content tone: ${TONE_LABELS[tone] ?? tone}.`);

  if (brand.styleKeywords.length > 0) {
    parts.push(`Style keywords to embody: ${brand.styleKeywords.join(", ")}.`);
  }

  if (brand.bannedPhrases.length > 0) {
    parts.push(
      `\n🚫 STRICTLY AVOID these banned phrases/words: ${brand.bannedPhrases.join(", ")}.`,
    );
  }

  if (brand.bannedClaims.length > 0) {
    parts.push(`🚫 Do not make these claims: ${brand.bannedClaims.join(", ")}.`);
  }

  if (brand.ctaPreferences) {
    parts.push(`CTA preference: ${brand.ctaPreferences}.`);
  }

  if (brand.visualStyle) {
    parts.push(`Visual style direction: ${brand.visualStyle}.`);
  }

  if (brand.colorReferences.length > 0) {
    parts.push(`Color references: ${brand.colorReferences.join(", ")}.`);
  }

  if (brand.negativePrompts.length > 0) {
    parts.push(
      `Visual negative prompts (avoid these in generated images): ${brand.negativePrompts.join(", ")}.`,
    );
  }

  // STRICT brand focus enforcement
  parts.push(
    `\n⚠️ CRITICAL BRAND FOCUS RULE:`,
    `Every piece of content you generate must be about **${brand.name}** — its products, ingredients, results, or values.`,
    `Do NOT mention unrelated ingredients, products, or topics.`,
    `If the source content mentions a different topic, weave it through the lens of ${brand.name} only.`,
    `The final content must feel like it was written by ${brand.name}'s own social media team.`,
  );

  parts.push(`\n${task}`);

  parts.push(
    "\n\nIMPORTANT: Respond with ONLY valid JSON matching the schema. No markdown, no explanations, no text outside the JSON object.",
  );

  return parts.join("\n");
}

// ─── OllamaContentService ───────────────────────────────────────────────────

export class OllamaContentService {
  constructor(
    private readonly client: OllamaClient,
    private readonly textModel: string = process.env["OLLAMA_TEXT_MODEL"] ?? "llama3.2:latest",
    private readonly disableThinking = true,
  ) {}

  // ─── 1. Feed Post Variants ─────────────────────────────────────────────────

    private langLine(brand: BrandProfile): string {
    const lang = brand.preferredLanguage
      ? (`Language: Write ALL content in the "${brand.preferredLanguage}" language`)
      : null;
    const dial = brand.dialect ? (`Dialect register: "${brand.dialect}"`) : null;
    if (!lang && !dial) return "";
    const parts = [lang, dial].filter(Boolean).join("; ") + ".";
    return `\n- ${parts}`;
  }

async generateFeedPostVariants(
    brand: BrandProfile,
    source: string,
    tone: TonePreset,
    count = 3,
  ): Promise<FeedPostVariantsResponse> {
    // IMPORTANT: embed brand name and key brand identity directly in the
    // prompt field so the model sees it as primary context, not just in
    // the system prompt where it can be deprioritized.
    const task = `Generate ${count} distinct Instagram feed post caption variants for the brand "${brand.name}" about the following topic:\n\n"${source}"\n\nBrand identity to strictly follow:\n- Products/ingredients: ${brand.description ?? brand.name}\n- Tone: ${TONE_LABELS[tone] ?? tone}\n${brand.styleKeywords.length > 0 ? `- Style keywords: ${brand.styleKeywords.join(", ")}` : ""}\n${brand.bannedPhrases.length > 0 ? `- NEVER mention these: ${brand.bannedPhrases.join(", ")}` : ""}\n\n${this.langLine(brand)}\n\nEach variant must include:\n- caption: The full Instagram caption (can include line breaks)\n- hook: The opening hook line (1-2 sentences)\n- body: The main body copy after the hook\n- cta: A call-to-action\n- hashtags: 5-15 relevant hashtags\n- altTextSuggestion: Accessibility alt text for the image\n- visualConceptPrompts: Array of exactly 3 detailed image generation prompts\n\nReturn a JSON object with a "variants" array containing ${count} variant objects. Do NOT mention any other brand or ingredient besides "${brand.name}".`;

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, FeedPostVariantsResponseSchema);
  }

  // ─── 2. Carousel Content ───────────────────────────────────────────────────

  async generateCarouselContent(
    brand: BrandProfile,
    source: string,
    tone: TonePreset,
  ): Promise<CarouselResponse> {
    const task = `Generate a complete Instagram carousel content plan for the brand "${brand.name}" about:\n\n"${source}"\n\nBrand identity:\n- ${brand.description ?? brand.name}\n- Tone: ${TONE_LABELS[tone] ?? tone}\n${brand.styleKeywords.length > 0 ? `- Style keywords: ${brand.styleKeywords.join(", ")}` : ""}\n${brand.bannedPhrases.length > 0 ? `- NEVER mention these: ${brand.bannedPhrases.join(", ")}` : ""}\n\n${this.langLine(brand)}\n\nThe carousel should have 5-10 slides. Return a JSON object with:\n- conceptDirections: 3 different concept directions for the carousel\n- coverHook: The hook text for the cover/first slide\n- slideStructure: Array of slides with slideNumber, heading, and optional subtext\n- slideCopy: Copy for each slide with slideNumber, copy text, and visualPrompt\n- caption: The post caption\n- cta: Call to action\n- visualPrompts: Image generation prompts for each slide\n- coverImageConcept: Description of the cover image concept\n\nReturn ONLY valid JSON. Do NOT mention any other brand or ingredient besides "${brand.name}".`;

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, CarouselResponseSchema);
  }

  // ─── 3. Reel Content ───────────────────────────────────────────────────────

  async generateReelContent(
    brand: BrandProfile,
    source: string,
    tone: TonePreset,
  ): Promise<ReelResponse> {
    const task = `Generate a complete Instagram Reel content plan for the brand "${brand.name}" about:\n\n"${source}"\n\nBrand identity:\n- ${brand.description ?? brand.name}\n- Tone: ${TONE_LABELS[tone] ?? tone}\n${brand.styleKeywords.length > 0 ? `- Style keywords: ${brand.styleKeywords.join(", ")}` : ""}\n${brand.bannedPhrases.length > 0 ? `- NEVER mention these: ${brand.bannedPhrases.join(", ")}` : ""}\n\n${this.langLine(brand)}

Return a JSON object with:\n- hookDirections: 3 different hook options with direction, hookText, and whyItWorks\n- scriptOrTalkingPoints: Full script outline or key talking points\n- shotList: Array of individual shots/scene descriptions\n- visualStoryboard: Overall visual direction for the reel\n- caption: The post caption\n- cta: Call to action\n- thumbnailCoverConcept: Description of the thumbnail/cover idea\n\nReturn ONLY valid JSON. Do NOT mention any other brand or ingredient besides "${brand.name}".`;

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, ReelResponseSchema);
  }

  // ─── 4. Story Content ─────────────────────────────────────────────────────

  async generateStoryContent(
    brand: BrandProfile,
    source: string,
    tone: TonePreset,
  ): Promise<StoryResponse> {
    const task = `Generate a complete Instagram Story content plan for the brand "${brand.name}" about:\n\n"${source}"\n\nBrand identity:\n- ${brand.description ?? brand.name}\n- Tone: ${TONE_LABELS[tone] ?? tone}\n${brand.styleKeywords.length > 0 ? `- Style keywords: ${brand.styleKeywords.join(", ")}` : ""}\n${brand.bannedPhrases.length > 0 ? `- NEVER mention these: ${brand.bannedPhrases.join(", ")}` : ""}\n\n${this.langLine(brand)}

Return a JSON object with:\n- conceptDirections: 3 different concept directions for the story\n- frameSequence: Array of 3-5 frames with frameNumber, concept, visualPrompt, optional stickerSuggestions\n- frameByFrameCopy: Copy for each frame with frameNumber, copy, and optional cta\n- stickerSuggestions: General sticker suggestions for the story\n- ctaProgression: How the CTA evolves across frames\n- visualPrompts: Image generation prompts for each frame\n\nReturn ONLY valid JSON. Do NOT mention any other brand or ingredient besides "${brand.name}".`;

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, StoryResponseSchema);
  }

  // ─── 5. Regenerate Section ─────────────────────────────────────────────────

  async regenerateSection(
    _draftId: string,
    sectionType: SectionType,
    brand: BrandProfile,
    instruction: string,
  ): Promise<RegenerateSectionResponse> {
    const label = SECTION_TYPE_LABELS[sectionType] ?? sectionType;

    const systemPrompt = buildSystemPrompt(
      brand,
      "CASUAL",
      `Regenerate only the "${label}" section based on the following instruction:\n\n"${instruction}"\n\nReturn a JSON object with:\n- sectionType: "${sectionType}"\n- newContent: The regenerated ${label}\n- reasoning: Brief explanation of what changed and why\n\nReturn ONLY valid JSON.`,
    );

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: instruction,
      system: systemPrompt,
        disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, RegenerateSectionResponseSchema);
  }

  // ─── 6. Generate Hashtags ─────────────────────────────────────────────────

  async generateHashtags(caption: string, count = 15): Promise<HashtagsResponse> {
    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: `Based on the following Instagram caption, generate ${count} relevant hashtags grouped by category:\n\n"${caption}"\n\nReturn a JSON object with:\n- hashtags: Array of ${count} hashtag strings (including the # symbol)\n- categories: Optional record of category names to arrays of hashtag strings\n\nReturn ONLY valid JSON.`,
        disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, HashtagsResponseSchema);
  }

  // ─── 7. Summarize Analytics ────────────────────────────────────────────────

  async summarizeAnalytics(analyticsText: string): Promise<AnalyticsSummaryResponse> {
    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: `Analyze the following Instagram analytics data and provide a concise, actionable summary:\n\n${analyticsText}\n\nReturn a JSON object with:\n- summary: A 2-3 sentence overview of overall performance\n- keyHighlights: Array of 3-5 bullet point key findings\n- recommendedActions: Array of recommended next steps (optional)\n- topPerformingFormat: The content format with highest engagement (optional)\n- topPerformingHookType: The hook type/style that performed best (optional)\n\nReturn ONLY valid JSON.`,
        disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, AnalyticsSummaryResponseSchema);
  }

  // ─── 8. Analyze Hook Effectiveness ───────────────────────────────────────

  async analyzeHookEffectiveness(
    postsWithHooks: { hook: string; engagement: number }[],
  ): Promise<HookEffectivenessResponse> {
    const formatted = postsWithHooks
      .map((p, i) => `[${i + 1}] Hook: "${p.hook}" | Engagement: ${p.engagement}`)
      .join("\n");

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: `Analyze the following Instagram post hooks and their engagement metrics. Identify patterns, what works, and provide recommendations:\n\n${formatted}\n\nReturn a JSON object with:\n- analysis: A paragraph summarizing the overall hook effectiveness\n- patterns: Array of pattern objects with pattern name, count, avgEngagement, and exampleHooks\n- recommendations: Array of actionable recommendations for improving hooks\n- bestHooks: Array of the top 3 best-performing hooks\n\nReturn ONLY valid JSON.`,
        disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, HookEffectivenessResponseSchema);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const ollamaContentService = new OllamaContentService(new OllamaClient());
