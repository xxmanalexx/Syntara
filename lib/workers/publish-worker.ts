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
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error(`Publish worker error for post ${scheduledPost.id}:`, err);
      }
    }

    return { processed: duePosts.length, succeeded, failed };
  }

  private async processPost(scheduledPost: any): Promise<{ success: boolean; instagramId?: string; permalink?: string; errorCode?: string; errorMessage?: string }> {
    const draft = scheduledPost.draft;
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { workspaceId: scheduledPost.workspaceId, platform: "INSTAGRAM" },
    });

    if (!socialAccount || !socialAccount.accessToken || !socialAccount.instagramId) {
      return { success: false, errorCode: "NO_ACCOUNT", errorMessage: "No connected Instagram account" };
    }

    const igService = new InstagramPublishingService(socialAccount.accessToken);
    const mediaAssets = draft.mediaAssets ?? [];

    try {
      let result;

      if (draft.contentType === "FEED_POST") {
        const primaryImage = mediaAssets.find((m: any) => m.isPrimary)?.asset ?? mediaAssets[0]?.asset;
        if (!primaryImage) return { success: false, errorCode: "NO_MEDIA", errorMessage: "No image attached to post" };

        result = await igService.publishFeedPost({
          imageUrl: primaryImage.asset.url,
          caption: draft.caption ?? "",
          altText: draft.altText ?? undefined,
        });
      } else if (draft.contentType === "CAROUSEL") {
        const imageUrls = mediaAssets.map((m: any) => m.asset.url);
        if (imageUrls.length < 2) return { success: false, errorCode: "INSUFFICIENT_MEDIA", errorMessage: "Carousel needs at least 2 images" };

        result = await igService.publishCarousel({
          imageUrls,
          caption: draft.caption ?? "",
          altText: draft.altText,
        });
      } else if (draft.contentType === "REEL") {
        return { success: false, errorCode: "NOT_IMPLEMENTED", errorMessage: "Reel publishing not yet implemented" };
      } else {
        return { success: false, errorCode: "UNSUPPORTED_TYPE", errorMessage: `Content type ${draft.contentType} not supported` };
      }

      await this.schedulingService.updateStatus(scheduledPost.id, "PUBLISHED", {
        instagramId: result.id,
        permalink: result.permalink,
      });

      await prisma.draft.update({
        where: { id: draft.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });

      return { success: true, instagramId: result.id, permalink: result.permalink };
    } catch (err: any) {
      const retryCount = (scheduledPost.retryCount ?? 0) + 1;
      const isRetryable = err.message?.includes("rate") || err.message?.includes("timeout");

      if (isRetryable && retryCount < 3) {
        await this.schedulingService.updateStatus(scheduledPost.id, "SCHEDULED", {
          lastError: err.message,
          retryCount,
        });
      } else {
        await this.schedulingService.updateStatus(scheduledPost.id, "FAILED", {
          lastError: err.message,
          retryCount,
        });
      }

      return { success: false, errorCode: err.code ?? "UNKNOWN", errorMessage: err.message };
    }
  }
}
