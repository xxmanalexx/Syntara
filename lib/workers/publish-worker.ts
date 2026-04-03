import { prisma } from "@/lib/db";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { InstagramPublishingService } from "@/lib/integrations/instagram/publishing-service";

export class PublishWorker {
  private schedulingService = new SchedulingService();

  async run(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const duePosts = await this.schedulingService.getDuePosts();

    let succeeded = 0;
    let failed = 0;

    for (const scheduledPost of duePosts) {
      try {
        const result = await this.processPost(scheduledPost);

        // Always record the attempt
        await this.schedulingService.recordAttempt(scheduledPost.id, result);

        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (err: any) {
        failed++;
        console.error(`Publish worker error for post ${scheduledPost.id}:`, err);
        await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", {
          lastError: err.message,
        });
      }
    }

    return { processed: duePosts.length, succeeded, failed };
  }

  private async processPost(scheduledPost: any): Promise<{
    success: boolean;
    instagramId?: string;
    permalink?: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const draft = scheduledPost.draft;
    if (!draft) {
      return { success: false, errorCode: "NO_DRAFT", errorMessage: "Draft not found for scheduled post" };
    }

    // Apply variant data if a specific variant was selected for this schedule
    let caption = draft.caption ?? "";
    let ctaText = "";
    let hashtags = "";
    if (scheduledPost.variantId && Array.isArray(draft.variants)) {
      const variant = draft.variants.find((v: any) => v.id === scheduledPost.variantId);
      if (variant?.data) {
        const vd = variant.data as Record<string, string>;
        if (vd.platform) {
          caption = vd.caption ?? caption;
          ctaText = vd.cta ?? "";
          hashtags = vd.hashtags ?? "";
        }
      }
    }
    // Build the full caption: [caption][\n\n][cta][\n\n][hashtags]
    const fullCaption = [caption, ctaText, hashtags].filter(Boolean).join("\n\n");

    const socialAccount = await prisma.socialAccount.findFirst({
      where: { workspaceId: scheduledPost.workspaceId, platform: "INSTAGRAM" },
    });

    if (!socialAccount?.accessToken) {
      return { success: false, errorCode: "NO_ACCOUNT", errorMessage: "No connected Instagram account" };
    }

    const igUserId = socialAccount.instagramId ?? undefined;
    if (!igUserId) {
      return { success: false, errorCode: "NO_ACCOUNT", errorMessage: "Instagram account ID not found — please re-connect Instagram" };
    }
    const igService = new InstagramPublishingService(socialAccount.accessToken);

    // Get media assets — DraftMedia has { draftId, assetId, isPrimary, sortOrder }
    // The 'asset' relation is MediaAsset { id, url, mimeType, ... }
    const rawMedia = draft.mediaAssets ?? [];
    const mediaAssets = Array.isArray(rawMedia) ? rawMedia : [];

    try {
      if (draft.contentType === "FEED_POST") {
        const mediaItem = mediaAssets.find((m: any) => m.isPrimary) ?? mediaAssets[0];
        const asset = mediaItem?.asset;
        if (!asset?.url) {
          await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", { lastError: "No image attached to post" });
          return { success: false, errorCode: "NO_MEDIA", errorMessage: "No image attached to post" };
        }

        const result = await igService.publishFeedPost(
          { imageUrl: asset.url as string, caption: fullCaption, altText: (draft.altText ?? undefined) as string | undefined },
          igUserId
        );

        await prisma.draft.update({ where: { id: draft.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await this.schedulingService.updateStatus(scheduledPost.id, "PUBLISHED", { instagramId: result.id, permalink: result.permalink });
        return { success: true, instagramId: result.id, permalink: result.permalink };

      } else if (draft.contentType === "CAROUSEL") {
        const imageUrls = mediaAssets.map((m: any) => m.asset?.url).filter(Boolean) as string[];
        if (imageUrls.length < 2) {
          await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", { lastError: "Carousel needs at least 2 images" });
          return { success: false, errorCode: "INSUFFICIENT_MEDIA", errorMessage: "Carousel needs at least 2 images" };
        }

        const result = await igService.publishCarousel(
          { imageUrls, caption: fullCaption, altText: (draft.altText ?? undefined) as string | undefined },
          igUserId
        );

        await prisma.draft.update({ where: { id: draft.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await this.schedulingService.updateStatus(scheduledPost.id, "PUBLISHED", { instagramId: result.id, permalink: result.permalink });
        return { success: true, instagramId: result.id, permalink: result.permalink };

      } else if (draft.contentType === "REEL") {
        await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", { lastError: "Reel publishing not yet implemented" });
        return { success: false, errorCode: "NOT_IMPLEMENTED", errorMessage: "Reel publishing not yet implemented" };

      } else if (draft.contentType === "STORY") {
        const mediaItem = mediaAssets.find((m: any) => m.isPrimary) ?? mediaAssets[0];
        const asset = mediaItem?.asset;
        if (!asset?.url) {
          await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", { lastError: "No image attached to story" });
          return { success: false, errorCode: "NO_MEDIA", errorMessage: "No image attached to story" };
        }

        const result = await igService.publishStory({ imageUrl: asset.url as string }, igUserId);

        await prisma.draft.update({ where: { id: draft.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await this.schedulingService.updateStatus(scheduledPost.id, "PUBLISHED", { instagramId: result.id, permalink: result.permalink });
        return { success: true, instagramId: result.id, permalink: result.permalink };

      } else {
        await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", { lastError: `Content type ${draft.contentType} not supported` });
        return { success: false, errorCode: "UNSUPPORTED_TYPE", errorMessage: `Content type ${draft.contentType} not supported` };
      }
    } catch (err: any) {
      const retryCount = (scheduledPost.retryCount ?? 0) + 1;
      const isRetryable = err.message?.includes("rate") || err.message?.includes("timeout") || err.message?.includes("retry");

      if (isRetryable && retryCount < 3) {
        await this.schedulingService.updateStatus(scheduledPost.id, "SCHEDULED", { lastError: err.message, retryCount });
      } else {
        await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", { lastError: err.message, retryCount });
      }

      return { success: false, errorCode: err.code ?? "UNKNOWN", errorMessage: err.message };
    }
  }
}
