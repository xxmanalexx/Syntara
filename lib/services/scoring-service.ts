import { prisma } from "@/lib/db";
import type { ContentInsight } from "@/types";
import type { InsightType } from "@/types";
import type { Draft } from "@/types";

function nullToUndef<T>(): T | undefined {
  return undefined;
}

export class ContentScoringService {
  async scoreDraft(draft: Draft): Promise<{
    readinessScore: number;
    brandScore: number;
    completenessScore: number;
    insights: Omit<ContentInsight, "id" | "draftId" | "createdAt">[];
  }> {
    const insights: Omit<ContentInsight, "id" | "draftId" | "createdAt">[] = [];
    let completenessScore = 0;
    let readinessScore = 0;
    let brandScore = 100;

    // --- Completeness ---
    const checks = [
      draft.caption || draft.reelCaption,
      draft.cta,
      draft.hashtags?.length,
      draft.mediaAssets?.length,
    ];
    const filledChecks = checks.filter(Boolean).length;
    completenessScore = Math.round((filledChecks / checks.length) * 100);

    // Missing media — completeness penalty + no readiness bonus
    if (!draft.mediaAssets?.length && draft.status !== "PUBLISHED") {
      insights.push({
        insightType: "MISSING_MEDIA",
        severity: "warning",
        message: "No media attached. Posts with images get significantly more engagement.",
        data: undefined,
      });
      completenessScore -= 25;
    } else if ((draft.mediaAssets?.length ?? 0) > 0) {
      // Media attached — readiness bonus
      readinessScore += 20;
    }

    // Caption length
    const captionLength = (draft.caption ?? "").length;
    if (captionLength === 0) {
      insights.push({ insightType: "MISSING_MEDIA", severity: "critical", message: "No caption generated.", data: undefined });
    } else if (captionLength < 50) {
      insights.push({ insightType: "WEAK_HOOK", severity: "warning", message: "Caption is very short. Consider expanding the hook.", data: undefined });
      readinessScore += 20;
    } else if (captionLength > 2000) {
      insights.push({ insightType: "OVERLENGTH", severity: "warning", message: "Caption is very long and may get truncated in the feed.", data: undefined });
    } else {
      readinessScore += 25;
    }

    // Hashtags
    const hashtagCount = draft.hashtags?.length ?? 0;
    if (hashtagCount === 0) {
      insights.push({ insightType: "MISSING_MEDIA", severity: "info", message: "No hashtags. Consider adding relevant hashtags.", data: undefined });
    } else if (hashtagCount > 20) {
      insights.push({ insightType: "OVERLENGTH", severity: "info", message: "Over 20 hashtags may look spammy. Consider trimming to 10-15.", data: undefined });
    } else {
      readinessScore += 15;
    }

    // CTA
    if (!draft.cta) {
      insights.push({ insightType: "MISSING_MEDIA", severity: "info", message: "No CTA. A call-to-action drives more engagement.", data: undefined });
    } else {
      readinessScore += 15;
    }

    // Hook check for reels
    if (draft.contentType === "REEL" && draft.reelHook && draft.reelHook.length < 20) {
      insights.push({ insightType: "WEAK_HOOK", severity: "warning", message: "Reel hook may be too weak. First 3 seconds are critical.", data: undefined });
    }

    // Brand alignment check (simple keyword scan)
    if (draft.brand) {
      const content = [(draft.caption ?? ""), (draft.reelHook ?? ""), (draft.reelCaption ?? "")].join(" ").toLowerCase();
      const bannedMatch = (draft.brand.bannedPhrases ?? []).find((p: string) => content.includes(p.toLowerCase()));
      if (bannedMatch) {
        insights.push({
          insightType: "BRAND_ALIGNMENT",
          severity: "critical",
          message: `Content may contain banned phrase: "${bannedMatch}"`,
          data: { bannedPhrase: bannedMatch },
        });
        brandScore -= 30;
      }
    }

    // Duplicate check
    if (draft.duplicateFlag) {
      insights.push({ insightType: "DUPLICATE_WARNING", severity: "warning", message: "This content is similar to a recent post.", data: undefined });
      readinessScore -= 20;
    }

    // Visual mismatch
    const hasVisualAssets = (draft.mediaAssets?.length ?? 0) > 0;
    const hasVisualPrompts = !!(draft as any).visualPrompts?.length;
    if (hasVisualPrompts && !hasVisualAssets) {
      insights.push({ insightType: "VISUAL_MISMATCH", severity: "info", message: "Visual prompts generated but no images attached yet.", data: undefined });
    }

    readinessScore = Math.max(0, Math.min(100, readinessScore));
    brandScore = Math.max(0, Math.min(100, brandScore));

    // Post readiness
    if (completenessScore >= 75 && readinessScore >= 60 && brandScore >= 70) {
      insights.push({
        insightType: "POST_READINESS",
        severity: "info",
        message: "Post looks ready to publish!",
        data: { readinessScore, brandScore, completenessScore },
      });
    }

    return { readinessScore, brandScore, completenessScore, insights };
  }

  async updateScores(draftId: string): Promise<void> {
    const draft = await prisma.draft.findUnique({
      where: { id: draftId },
      include: {
        brand: true,
        mediaAssets: { include: { asset: true } },
        variants: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    if (!draft) return;

    const { readinessScore, brandScore, completenessScore, insights } = await this.scoreDraft(draft as unknown as Draft);

    const isReady = completenessScore >= 75 && readinessScore >= 60 && brandScore >= 70;

    await prisma.$transaction([
      prisma.draft.update({
        where: { id: draftId },
        data: {
          readinessScore,
          brandScore,
          completenessScore,
          duplicateFlag: insights.some(i => i.insightType === "DUPLICATE_WARNING"),
          status: isReady ? "READY" : "DRAFT",
        },
      }),
      prisma.contentInsight.deleteMany({ where: { draftId } }),
      prisma.contentInsight.createMany({
        data: insights.map(({ insightType, severity, message, data }) => ({
          draftId, insightType, severity, message, data: data as any,
        })),
      }),
    ]);
  }
}
