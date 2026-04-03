import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { generateContentSchema } from "@/lib/validation";
import { OllamaClient } from "@/lib/integrations/ollama/client";
import type { TonePreset } from "@/types";

// Allow up to 5 minutes for content generation (Reel/Story are heavy)
export const maxDuration = 300;
import { OllamaContentService } from "@/lib/integrations/ollama/content-service";
import { DraftService } from "@/lib/services/draft-service";
import { ContentScoringService } from "@/lib/services/scoring-service";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);

const draftService = new DraftService();
const scoringService = new ContentScoringService();

async function getOllamaConfig(workspaceId: string) {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
  });
  return {
    baseUrl: settings?.ollamaBaseUrl ?? process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    textModel: settings?.ollamaTextModel ?? process.env["OLLAMA_TEXT_MODEL"] ?? "minimax-m2.7:cloud",
    embeddingsModel: settings?.ollamaEmbeddingsModel ?? process.env["OLLAMA_EMBEDDINGS_MODEL"] ?? "nomic-embed-text:latest",
  };
}

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let workspaceId: string;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      workspaceId = payload.workspaceId as string;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // ── Validate input ───────────────────────────────────────────────────────
    const body = await req.json();
    const parsed = generateContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { brandId, contentType, sourceContent, tone, regenerateFromDraftId } = parsed.data;

    // ── Resolve brand, content type, source content, and tone ──────────────────
    let resolvedBrandId: string = brandId ?? "";
    let resolvedSourceContent: string = sourceContent ?? "";
    let resolvedContentType: "FEED_POST" | "CAROUSEL" | "REEL" | "STORY" | undefined = contentType;
    let resolvedTone: TonePreset = (parsed.data.tone as TonePreset) ?? "CASUAL";

    if (regenerateFromDraftId) {
      const existingDraft = await prisma.draft.findFirst({
        where: { id: regenerateFromDraftId, workspaceId },
        include: { brand: true },
      });
      if (!existingDraft) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }
      resolvedBrandId = (existingDraft.brandId ?? brandId ?? "") as string;
      resolvedSourceContent = (existingDraft.caption ?? sourceContent ?? "") as string;
      // Preserve the original tone from the draft, unless overridden in request body
      if (!parsed.data.tone && existingDraft.tone) {
        resolvedTone = existingDraft.tone as TonePreset;
      }
    }

    if (!resolvedBrandId) {
      return NextResponse.json({ error: "Brand ID is required" }, { status: 400 });
    }
    if (!resolvedContentType) {
      return NextResponse.json({ error: "Content type is required" }, { status: 400 });
    }

    // ── Verify brand belongs to this workspace ───────────────────────────────
    const brand = await prisma.brandProfile.findFirst({
      where: { id: resolvedBrandId, workspaceId },
    });
    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found in your workspace" },
        { status: 404 }
      );
    }

    console.log(`[Generate] workspace=${workspaceId} brandId=${resolvedBrandId} brand=${brand.name}`);
    console.log(`[Generate] brand.keywords=${brand.styleKeywords.join(", ")}`);
    console.log(`[Generate] brand.banned=${brand.bannedPhrases.join(", ")}`);

    // ── Load Ollama config ──────────────────────────────────────────────────
    const ollamaConfig = await getOllamaConfig(workspaceId);
    console.log(`[Generate] brand=${brand.name} model=${ollamaConfig.textModel}`);

    const ollamaClient = new OllamaClient(ollamaConfig.baseUrl);
    const contentService = new OllamaContentService(
      ollamaClient,
      ollamaConfig.textModel,
      true // disableThinking
    );

    // ── Create or reuse draft ─────────────────────────────────────────────────
    const isRegenerate = !!regenerateFromDraftId;
    const targetDraftId = isRegenerate
      ? regenerateFromDraftId
      : (await draftService.create({ workspaceId, brandId: resolvedBrandId, contentType: resolvedContentType!, tone: resolvedTone! })).id;

    // ── Generate content ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (resolvedContentType) {
      case "FEED_POST":
        result = await contentService.generateFeedPostVariants(brand as any, resolvedSourceContent, resolvedTone!);
        break;
      case "CAROUSEL":
        result = await contentService.generateCarouselContent(brand as any, resolvedSourceContent, resolvedTone!);
        break;
      case "REEL":
        result = await contentService.generateReelContent(brand as any, resolvedSourceContent, resolvedTone!);
        break;
      case "STORY":
        result = await contentService.generateStoryContent(brand as any, resolvedSourceContent, resolvedTone!);
        break;
      default:
        return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }

    // ── Score variants for viral potential ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variants: any[] = result.variants ?? [result];

    const viralScores: number[] = [];
    for (const v of variants) {
      try {
        const score = await contentService.analyzeViralPotential(
          (v.caption ?? ""),
          v.cta ?? null,
          v.hashtags ?? [],
          resolvedContentType!,
          resolvedTone!
        );
        viralScores.push(score.overallScore);
      } catch {
        viralScores.push(0); // score unavailable — put at end
      }
    }

    // ── Sort variants by viral score (highest first) ─────────────────────────
    const sorted = variants
      .map((v, i) => ({ v, score: viralScores[i] }))
      .sort((a, b) => b.score - a.score);

    // ── Save variants with viral scores ──────────────────────────────────────
    await draftService.saveGeneratedVariants(
      targetDraftId,
      sorted.map(({ v }) => ({
        caption: v.caption,
        hook: v.hook,
        body: v.body,
        cta: v.cta,
        hashtags: v.hashtags,
        slideTexts: v.slideTexts,
        frameCopies: v.frameCopies,
        visualPrompts: v.visualPrompts ?? v.visualConceptPrompts ?? [],
      })),
      sorted.map(({ score }) => score)
    );

    // ── Apply top viral variant to draft ────────────────────────────────────
    const first = sorted[0].v;

    // For STORY: use frameByFrameCopy (structured objects) for storyFrames
    const storyFrames = resolvedContentType === "STORY"
      ? (first.frameByFrameCopy ?? []).map((f: { frameNumber?: number; copy?: string; cta?: string }, i: number) => ({
          frameNumber: f.frameNumber ?? i + 1,
          copy: f.copy ?? "",
          cta: f.cta ?? null,
        }))
      : (first.frameCopies as string[] | undefined)?.map((fc: string, i: number) => ({
          frameNumber: i + 1,
          copy: fc,
        }));

    await draftService.update(targetDraftId, {
      caption: first.caption ?? "",
      cta: first.cta ?? null,
      hashtags: first.hashtags ?? [],
      reelHook: first.hook ?? first.reelHook ?? null,
      reelScript: first.script ?? null,
      reelShotList: first.shotList ?? [],
      reelCaption: first.caption ?? null,
      storyFrames,
    });

    // ── Score ───────────────────────────────────────────────────────────────
    await scoringService.updateScores(targetDraftId);
    const updatedDraft = await draftService.getById(targetDraftId);

    return NextResponse.json({
      draft: updatedDraft,
      variants: sorted.map(({ v, score }, i) => ({ ...v, viralScore: score, _rank: i + 1 })),
      viralScores: sorted.map(({ score }) => score),
      imagePrompts: result.imagePrompts ?? [],
    });
  } catch (err: any) {
    console.error("[Generate] Error:", err);
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
