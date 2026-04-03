import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ollamaContentService } from "@/lib/integrations/ollama/content-service";

function getAuthUser(token: string) {
  const { jwtVerify } = require("jose");
  return jwtVerify(token, new TextEncoder().encode(process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"))
    .then(({ payload }: any) => payload);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const analysis = await prisma.viralAnalysis.findUnique({
      where: { draftId: params.id },
    });

    return NextResponse.json({ analysis });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const draftId = params.id;

    // Load draft with selected variant
    const draft = await prisma.draft.findUnique({
      where: { id: draftId },
      include: {
        brand: true,
        variants: { where: { isSelected: true }, take: 1 },
        mediaAssets: { include: { asset: true } },
      },
    });

    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    // Use selected variant data if available, otherwise draft-level fields
    const selectedVariant = draft.variants[0];
    let caption: string, cta: string | null, hashtags: string[];

    if (selectedVariant?.data) {
      const vd = selectedVariant.data as any;
      caption = vd.caption ?? draft.caption ?? "";
      cta = vd.cta ?? draft.cta ?? null;
      hashtags = vd.hashtags ?? draft.hashtags ?? [];
    } else {
      caption = draft.caption ?? "";
      cta = draft.cta ?? null;
      hashtags = draft.hashtags ?? [];
    }

    if (!caption) {
      return NextResponse.json({ error: "No caption to score — generate content first" }, { status: 400 });
    }

    // Call Ollama for viral analysis
    const result = await ollamaContentService.analyzeViralPotential(
      caption,
      cta,
      hashtags,
      draft.contentType,
      draft.tone,
    );

    // Store viral analysis in DB
    const analysis = await prisma.viralAnalysis.upsert({
      where: { draftId },
      create: {
        draftId,
        overallScore: result.overallScore,
        hookStrength: result.hookStrength,
        clarity: result.clarity,
        originality: result.originality,
        emotionalPull: result.emotionalPull,
        shareability: result.shareability,
        saveWorthiness: result.saveWorthiness,
        commentTrigger: result.commentTrigger,
        audienceFit: result.audienceFit,
        formatFit: result.formatFit,
        weaknesses: result.weaknesses,
        suggestions: result.suggestions,
        viralSummary: result.viralSummary ?? null,
        modelUsed: "ollama",
      },
      update: {
        overallScore: result.overallScore,
        hookStrength: result.hookStrength,
        clarity: result.clarity,
        originality: result.originality,
        emotionalPull: result.emotionalPull,
        shareability: result.shareability,
        saveWorthiness: result.saveWorthiness,
        commentTrigger: result.commentTrigger,
        audienceFit: result.audienceFit,
        formatFit: result.formatFit,
        weaknesses: result.weaknesses,
        suggestions: result.suggestions,
        viralSummary: result.viralSummary ?? null,
        modelUsed: "ollama",
      },
    });

    // Update draft viral score
    await prisma.draft.update({
      where: { id: draftId },
      data: { viralScore: result.overallScore },
    });

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("Viral scoring error:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Scoring failed" }, { status: 500 });
  }
}
