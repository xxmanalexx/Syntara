import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContentSchema } from "@/lib/validation";
import { OllamaClient } from "@/lib/integrations/ollama/client";
import { OllamaContentService } from "@/lib/integrations/ollama/content-service";
import { DraftService } from "@/lib/services/draft-service";
import { ContentScoringService } from "@/lib/services/scoring-service";

const draftService = new DraftService();
const scoringService = new ContentScoringService();

// Load workspace-level Ollama settings (or fall back to env vars)
async function getOllamaConfig(workspaceId: string) {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
  });
  return {
    baseUrl: settings?.ollamaBaseUrl ?? process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    textModel: settings?.ollamaTextModel ?? process.env["OLLAMA_TEXT_MODEL"] ?? "llama3.2:latest",
    embeddingsModel: settings?.ollamaEmbeddingsModel ?? process.env["OLLAMA_EMBEDDINGS_MODEL"] ?? "nomic-embed-text:latest",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = generateContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { brandId, contentType, sourceContent, tone } = parsed.data;

    const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    // Load per-workspace Ollama config
    const ollamaConfig = await getOllamaConfig(brand.workspaceId);
    console.log(`[Generate] Using model: ${ollamaConfig.textModel} @ ${ollamaConfig.baseUrl}`);

    const ollamaClient = new OllamaClient(ollamaConfig.baseUrl);
    const contentService = new OllamaContentService(ollamaClient, ollamaConfig.textModel, true);

    // Create draft
    const draft = await draftService.create({
      workspaceId: brand.workspaceId,
      brandId,
      contentType,
      tone,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (contentType) {
      case "FEED_POST":
        result = await contentService.generateFeedPostVariants(brand as any, sourceContent, tone);
        break;
      case "CAROUSEL":
        result = await contentService.generateCarouselContent(brand as any, sourceContent, tone);
        break;
      case "REEL":
        result = await contentService.generateReelContent(brand as any, sourceContent, tone);
        break;
      case "STORY":
        result = await contentService.generateStoryContent(brand as any, sourceContent, tone);
        break;
      default:
        return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }

    // Normalize variants — some methods return {variants: [...]} others return flat object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variants: any[] = result.variants ?? [result];

    await draftService.saveGeneratedVariants(draft.id, variants.map((v) => ({
      caption: v.caption,
      hook: v.hook,
      body: v.body,
      cta: v.cta,
      hashtags: v.hashtags,
      slideTexts: v.slideTexts,
      frameCopies: v.frameCopies,
      visualPrompts: v.visualPrompts,
    })));

    // Apply first variant to draft
    const first = variants[0];
    await draftService.update(draft.id, {
      caption: first.caption,
      cta: first.cta,
      hashtags: first.hashtags ?? [],
      reelHook: first.hook ?? first.reelHook,
      reelScript: first.script,
      reelShotList: first.shotList,
      reelCaption: first.caption,
      storyFrames: first.frameCopies?.map((fc: string, i: number) => ({
        frameNumber: i + 1,
        copy: fc,
      })),
    });

    // Score the draft
    const updatedDraft = await draftService.getById(draft.id);
    await scoringService.updateScores(draft.id);

    return NextResponse.json({
      draft: updatedDraft,
      variants,
      imagePrompts: result.imagePrompts ?? [],
    });
  } catch (err: any) {
    console.error("Content generation error:", err);
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
