import { prisma } from "@/lib/db";
import type { ScheduledPost, PublishResult } from "@/types";
import type { PublishStatus } from "@/types";

export class SchedulingService {
  async schedule(draftId: string, scheduledAt: Date, variantId?: string): Promise<ScheduledPost> {
    const existing = await prisma.scheduledPost.findUnique({ where: { draftId } });
    if (existing) {
      return prisma.scheduledPost.update({
        where: { draftId },
        data: { scheduledAt, variantId: variantId ?? null, publishStatus: "SCHEDULED", lastError: null },
      }) as Promise<ScheduledPost>;
    }

    return prisma.scheduledPost.create({
      data: {
        draftId,
        variantId: variantId ?? null,
        workspaceId: (await prisma.draft.findUnique({ where: { id: draftId } }))!.workspaceId,
        scheduledAt,
        publishStatus: "SCHEDULED",
      },
    }) as Promise<ScheduledPost>;
  }

  async unschedule(draftId: string): Promise<void> {
    await prisma.scheduledPost.deleteMany({ where: { draftId } });
  }

  async getByWorkspace(workspaceId: string): Promise<ScheduledPost[]> {
    return prisma.scheduledPost.findMany({
      where: { workspaceId },
      include: { draft: { include: { brand: true, mediaAssets: { include: { asset: true } }, variants: true } } },
      orderBy: { scheduledAt: "asc" },
    }) as Promise<ScheduledPost[]>;
  }

  async getDuePosts(now: Date = new Date()): Promise<ScheduledPost[]> {
    return prisma.scheduledPost.findMany({
      where: {
        publishStatus: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      include: { draft: { include: { brand: true, mediaAssets: { include: { asset: true } }, variants: true } } },
    }) as Promise<ScheduledPost[]>;
  }

  async updateStatus(id: string, status: PublishStatus, meta?: {
    instagramId?: string;
    permalink?: string;
    lastError?: string;
    retryCount?: number;
  }): Promise<void> {
    await prisma.scheduledPost.update({
      where: { id },
      data: {
        publishStatus: status,
        ...(meta?.instagramId && { instagramId: meta.instagramId }),
        ...(meta?.permalink && { permalink: meta.permalink }),
        ...(meta?.lastError && { lastError: meta.lastError }),
        ...(meta?.retryCount !== undefined && { retryCount: meta.retryCount }),
      },
    });
  }

  async recordAttempt(scheduledPostId: string, result: PublishResult): Promise<void> {
    const scheduledPost = await prisma.scheduledPost.findUnique({ where: { id: scheduledPostId } });
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { workspaceId: scheduledPost?.workspaceId ?? "", platform: "INSTAGRAM" },
    });
    await prisma.publishAttempt.create({
      data: {
        scheduledPostId,
        socialAccountId: socialAccount?.id,
        status: result.success ? "PUBLISHED" : "FAILED",
        instagramId: result.instagramId,
        permalink: result.permalink,
        errorMessage: result.errorMessage,
      },
    });
  }
}
