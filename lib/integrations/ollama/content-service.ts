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
  conceptDirections: z.array(
    z.union([z.string(), z.object({ direction: z.string(), concept: z.string().optional() }), z.record(z.string())])
  ).min(3).max(3),
  coverHook: z.string(),
  slideStructure: z.array(SlideStructureSchema).min(5).max(10),
  slideCopy: z.array(SlideCopySchema),
  caption: z.string(),
  cta: z.string(),
  visualPrompts: z.array(
    z.union([z.string(), z.object({ prompt: z.string(), concept: z.string().optional() }), z.record(z.string())])
  ).default([]),
  coverImageConcept: z.string(),
  generatedSlideVisuals: z.array(z.string()).default([]),
}).transform((obj) => ({
  ...obj,
  conceptDirections: obj.conceptDirections.map((d) => {
    if (typeof d === "string") return d;
    if (typeof d === "object" && d !== null) {
      if (d.direction) return String(d.direction);
      if (d.concept) return String(d.concept);
      const vals = Object.values(d).filter((v) => typeof v === "string");
      return vals[0] ?? Object.keys(d)[0] ?? "";
    }
    return String(d);
  }),
  visualPrompts: obj.visualPrompts.map((v) => {
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) {
      if (v.prompt) return String(v.prompt);
      if (v.concept) return String(v.concept);
      const vals = Object.values(v).filter((val) => typeof val === "string");
      return vals[0] ?? Object.keys(v)[0] ?? "";
    }
    return String(v);
  }),
}));

export type CarouselResponse = z.infer<typeof CarouselResponseSchema>;

// ─── Reel Schema ─────────────────────────────────────────────────────────────

const HookDirectionSchema = z.object({
  direction: z.string(),
  hookText: z.string(),
  whyItWorks: z.string().optional(),
});

const ReelResponseSchema = z.object({
  hookDirections: z.array(z.any()).min(3).max(3),
  scriptOrTalkingPoints: z.any().default(""),
  shotList: z.array(z.any()).default([]),
  visualStoryboard: z.any().default(""),
  caption: z.string(),
  cta: z.string(),
  thumbnailCoverConcept: z.any().default(""),
}).transform((obj) => {
  // scriptOrTalkingPoints: handle object { "0": "...", "1": "..." }, string, or array
  let scriptOrTalkingPoints = obj.scriptOrTalkingPoints;
  if (typeof scriptOrTalkingPoints === "object" && scriptOrTalkingPoints !== null && !Array.isArray(scriptOrTalkingPoints)) {
    const vals = Object.values(scriptOrTalkingPoints).flatMap((v) =>
      typeof v === "string" ? [v] : Array.isArray(v) ? v : []
    );
    scriptOrTalkingPoints = vals.join("\n");
  } else if (Array.isArray(scriptOrTalkingPoints)) {
    scriptOrTalkingPoints = scriptOrTalkingPoints.join("\n");
  }
  scriptOrTalkingPoints = String(scriptOrTalkingPoints ?? "");

  // shotList: extract string from any shape (string, { shot }, { "0": "text" }, { shotNumber: 1, shot: "..." })
  const shotList = (obj.shotList ?? []).map((s: unknown) => {
    if (typeof s === "string") return s;
    if (typeof s === "object" && s !== null) {
      const rec = s as Record<string, unknown>;
      if (rec.shot) return String(rec.shot);
      if (rec.description) return String(rec.description);
      if (rec.text) return String(rec.text);
      if (rec.content) return String(rec.content);
      if (rec.shotNumber !== undefined) {
        // It's a numbered shot object, build a string from available fields
        const parts = [];
        if (rec.shotNumber !== undefined) parts.push(`Shot ${rec.shotNumber}`);
        if (rec.description) parts.push(String(rec.description));
        return parts.join(": ") || `Shot ${rec.shotNumber}`;
      }
      const vals = Object.values(rec).filter((v) => typeof v === "string");
      return vals[0] ?? Object.keys(rec)[0] ?? "";
    }
    return String(s);
  });

  // visualStoryboard: extract string from any shape
  let visualStoryboard = obj.visualStoryboard;
  if (typeof visualStoryboard === "object" && visualStoryboard !== null) {
    const rec = visualStoryboard as Record<string, unknown>;
    if (rec.description) visualStoryboard = String(rec.description);
    else if (rec.text) visualStoryboard = String(rec.text);
    else {
      const vals = Object.values(rec).filter((v) => typeof v === "string");
      visualStoryboard = vals[0] ?? "";
    }
  }
  visualStoryboard = String(visualStoryboard ?? "");

  // thumbnailCoverConcept: extract string from any shape
  let thumbnailCoverConcept = obj.thumbnailCoverConcept;
  if (typeof thumbnailCoverConcept === "object" && thumbnailCoverConcept !== null) {
    const rec = thumbnailCoverConcept as Record<string, unknown>;
    if (rec.concept) thumbnailCoverConcept = String(rec.concept);
    else if (rec.description) thumbnailCoverConcept = String(rec.description);
    else if (rec.text) thumbnailCoverConcept = String(rec.text);
    else {
      const vals = Object.values(rec).filter((v) => typeof v === "string");
      thumbnailCoverConcept = vals[0] ?? "";
    }
  }
  thumbnailCoverConcept = String(thumbnailCoverConcept ?? "");

  // hookDirections: extract direction strings from any shape
  const hookDirections = (obj.hookDirections ?? []).map((h: unknown) => {
    if (typeof h === "string") return h;
    if (typeof h === "object" && h !== null) {
      const rec = h as Record<string, unknown>;
      if (rec.direction) return String(rec.direction);
      if (rec.hookText) return String(rec.hookText);
      if (rec.text) return String(rec.text);
      const vals = Object.values(rec).filter((v) => typeof v === "string");
      return vals[0] ?? Object.keys(rec)[0] ?? "";
    }
    return String(h);
  });

  return {
    hookDirections,
    scriptOrTalkingPoints,
    shotList,
    visualStoryboard,
    caption: obj.caption,
    cta: obj.cta,
    thumbnailCoverConcept,
  };
});

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
  conceptDirections: z.array(
    z.union([
      z.string(),
      z.record(z.string()), // handles { "0": "text" } or { direction: "...", concept: "..." }
    ])
  ).min(3).max(3),
  frameSequence: z.array(FrameSequenceSchema).min(3).max(5),
  frameByFrameCopy: z.array(FrameCopySchema),
  stickerSuggestions: z.array(z.string()),
  ctaProgression: z.union([z.array(z.string()), z.string()]).default([]),
  visualPrompts: z.array(
    z.union([
      z.string(),
      z.record(z.string()),
    ])
  ).default([]),
  caption: z.string().optional().default(""),
}).transform((obj) => {
  // conceptDirections: extract text from whatever format the model returns
  const conceptDirections = obj.conceptDirections.map((d) => {
    if (typeof d === "string") return d;
    if (typeof d === "object" && d !== null) {
      // Try known fields first
      if (d.direction) return String(d.direction);
      if (d.concept) return String(d.concept);
      // Fall back to first string value found
      const vals = Object.values(d).filter((v) => typeof v === "string");
      return vals[0] ?? Object.keys(d)[0] ?? "";
    }
    return String(d);
  });

  // visualPrompts: extract text
  const visualPrompts = (obj.visualPrompts ?? []).map((v) => {
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) {
      if (v.prompt) return String(v.prompt);
      if (v.concept) return String(v.concept);
      const vals = Object.values(v).filter((val) => typeof val === "string");
      return vals[0] ?? Object.keys(v)[0] ?? "";
    }
    return String(v);
  });

  const frameTexts = (obj.frameByFrameCopy ?? [])
    .map((f) => f.copy)
    .filter(Boolean)
    .join(" ");

  return {
    ...obj,
    conceptDirections,
    visualPrompts,
    caption: obj.caption || frameTexts || conceptDirections[0] || "",
    ctaProgression: Array.isArray(obj.ctaProgression) ? obj.ctaProgression : [obj.ctaProgression],
  };
});

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

// ─── Viral Scoring Schema ─────────────────────────────────────────────────────

const ViralScoringResponseSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("Overall viral potential 0-100"),
  hookStrength: z.number().min(0).max(10).describe("Hook strength 0-10"),
  clarity: z.number().min(0).max(10).describe("Content clarity 0-10"),
  originality: z.number().min(0).max(10).describe("Uniqueness/originality 0-10"),
  emotionalPull: z.number().min(0).max(10).describe("Emotional resonance 0-10"),
  shareability: z.number().min(0).max(10).describe("Likelihood to be shared 0-10"),
  saveWorthiness: z.number().min(0).max(10).describe("Value worth saving 0-10"),
  commentTrigger: z.number().min(0).max(10).describe("Ability to spark comments 0-10"),
  audienceFit: z.number().min(0).max(10).describe("Fits target audience 0-10"),
  formatFit: z.number().min(0).max(10).describe("Format suitability 0-10"),
  weaknesses: z.array(z.string()).describe("List of specific weaknesses in this caption"),
  rewrittenCaption: z.string().describe("A complete rewritten version of the caption that fixes the weaknesses — hook + body + CTA as one cohesive publish-ready piece with line breaks and hashtags included. This is what the user can use directly."),
  rewrittenCta: z.string().optional().describe("The rewritten CTA if it needs to change"),
  rewrittenHashtags: z.array(z.string()).optional().describe("Improved hashtag list"),
  viralSummary: z.string().optional().describe("One paragraph summary of viral potential"),
});

export type ViralScoringResponse = z.infer<typeof ViralScoringResponseSchema>;

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

  // Viral copywriting DNA — these principles govern ALL content generated
  parts.push(
    `\nVIRAL COPYWRITING PRINCIPLES (apply to every caption you generate):`,
    `• HOOK: First line MUST stop the scroll — curiosity gap, bold claim, relatable pain, or immediate emotion`,
    `• CLARITY: Every word earns its place. No fluff. No generic brand-speak`,
    `• ORIGINALITY: Say what competitors don't. Avoid overused phrases like "transform", "game-changer", "secret"`,
    `• EMOTIONAL PULL: Trigger a real feeling — awe, surprise, warmth, mild outrage, or "that's so true"`,
    `• SHAREABILITY: Write content someone would send to a friend or tag someone in`,
    `• SAVE-WORTHINESS: Make it genuinely useful so people bookmark it`,
    `• COMMENT TRIGGER: End with a question, controversial take, or "tag someone who..."`,
    `• AUDIENCE FIT: Mirror the audience's language, struggles, and aspirations exactly`,
    `• FORMAT FIT: For FEED_POST — hook in line 1, value in line 2, CTA at the end`,
  );

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
    const viralGuidelines = `VIRAL FORMULA — every caption MUST follow this exact structure:
1. LINE 1 (HOOK): Choose ONE scroll-stopper type — (a) shocking stat/fact, (b) bold contrarian claim, (c) "most people are wrong about...", (d) relatable pain in fresh words, or (e) curiosity gap
2. LINE 2: Immediately deliver unexpected value or twist — never waste line 2
3. BODY: Real numbers, specific stories, honest contrast. Zero generic praise ("best quality", "amazing results")
4. SOCIAL PROOF MOMENT: Credibility signal — study result, before/after, "X out of Y noticed...", real user truth
5. SOFT SELL: ${brand.name} enters NATURALLY — not as an ad, as the obvious clever solution
6. CTA people actually enjoy: Ask them to do something their peers are already doing (FOMO), or invite real questions

🚫 NEVER use these dead phrases — they kill viral potential instantly:
"تعرّف على" | "منتجاتنا" | "جرّبوا الآن" | "أفضل منتج" | "نتيجة مضمونة" | "اكتشفوا" | "سعر خاص" | "عرض محدود" | "هذا المنتج"
If you catch yourself writing any of these — STOP and rewrite from line 1.`;

    const task = `Write 3 Instagram feed post captions for "${brand.name}" about: "${source}"

BRAND VOICE: ${TONE_LABELS[tone] ?? tone}
${brand.styleKeywords.length > 0 ? `STYLE: ${brand.styleKeywords.join(", ")}` : ""}
${brand.bannedPhrases.length > 0 ? `🚫 NEVER say these: ${brand.bannedPhrases.join(", ")}` : ""}
${brand.ctaPreferences ? `CTA PREFERENCE: ${brand.ctaPreferences}` : ""}

${this.langLine(brand)}

${viralGuidelines}

Each caption must feel like a real person sharing real results — not a brand account.
The brand name "${brand.name}" should appear naturally once in each caption.

Return a JSON object with a "variants" array containing 3 distinct caption variants (vary the HOOK ANGLE for each — e.g. one stat-based, one story-based, one contrarian). Each variant must include:
- caption: Full Instagram caption — hook + body + CTA + hashtags, line breaks for rhythm, publish-ready
- hook: The opening hook line only (1-2 sentences)
- body: The main body copy
- cta: A call-to-action
- hashtags: 8-15 hashtags (mix of broad reach + niche community + 1 branded)
- altTextSuggestion: Alt text for the image
- visualConceptPrompts: Array of 3 image generation prompts

Return ONLY valid JSON. Do NOT mention any other brand besides "${brand.name}".`;

    const systemPrompt = buildSystemPrompt(brand, tone, task);

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      system: systemPrompt,
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

    const systemPrompt = buildSystemPrompt(brand, tone, task);

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      system: systemPrompt,
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

    const systemPrompt = buildSystemPrompt(brand, tone, task);
    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      system: systemPrompt,
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

    const systemPrompt = buildSystemPrompt(brand, tone, task);

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt: task,
      system: systemPrompt,
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

  // ─── 9. Viral Scoring ───────────────────────────────────────────────────────

  async analyzeViralPotential(
    caption: string,
    cta: string | null,
    hashtags: string[],
    contentType: string,
    tone: string,
  ): Promise<ViralScoringResponse> {
    const postContent = [
      caption,
      cta ? `\nCTA: ${cta}` : "",
      hashtags.length > 0 ? `\nHashtags: ${hashtags.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are an expert Instagram viral marketing analyst. Evaluate the following Instagram post and rewrite it to maximize viral potential.

POST CONTENT:
${postContent}

Content Type: ${contentType}
Tone: ${tone}

Score each dimension 0-10:
1. hookStrength — Does the opening hook grab attention immediately?
2. clarity — Is the message clear and easy to understand at a glance?
3. originality — Is the content unique vs. generic/overused phrasing?
4. emotionalPull — Does it evoke emotion (curiosity, awe, humor, outrage, warmth)?
5. shareability — Would someone send this to a friend?
6. saveWorthiness — Is it valuable enough to bookmark?
7. commentTrigger — Does it spark debate or invite responses?
8. audienceFit — Does it match what the target audience cares about?
9. formatFit — Is the format right for this message?

Also return:
- weaknesses: Array of 2-4 specific weaknesses (be brutally honest)
- rewrittenCaption: A COMPLETE rewritten version of the entire caption — hook + body + CTA as one cohesive, publish-ready piece with line breaks. Apply everything you learned from scoring. Make it scroll-stopping, specific, and emotionally resonant. Include hashtags inline at the end. This is what the user can paste directly into Instagram.
- rewrittenCta: The improved call-to-action (or omit if the caption ending is strong enough)
- viralSummary: One paragraph explaining why this caption will or won't go viral

Return ONLY valid JSON:
{
  "overallScore": number (0-100),
  "hookStrength": number (0-10),
  "clarity": number (0-10),
  "originality": number (0-10),
  "emotionalPull": number (0-10),
  "shareability": number (0-10),
  "saveWorthiness": number (0-10),
  "commentTrigger": number (0-10),
  "audienceFit": number (0-10),
  "formatFit": number (0-10),
  "weaknesses": string[],
  "rewrittenCaption": string (the complete rewritten caption with hook+body+CTA+hashtags, ready to publish),
  "rewrittenCta": string (optional),
  "viralSummary": string (optional)
}`;

    const request: OllamaGenerateRequest = {
      model: this.textModel,
      prompt,
      disableThinking: this.disableThinking,
      format: "json",
    };

    return this.client.generateJSON(request, ViralScoringResponseSchema);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const ollamaContentService = new OllamaContentService(new OllamaClient());
