import { prisma } from "@/lib/db";
import type { AnalyticsSummary, AnalyticsSnapshot } from "@/types";
import type { ContentType } from "@/types";

export class AnalyticsSyncService {
  private accessToken: string;
  private igUserId: string;

  constructor(accessToken: string, igUserId: string) {
    this.accessToken = accessToken;
    this.igUserId = igUserId;
  }

  async syncRecentMedia(
    workspaceId: string,
    socialAccountId: string,
    limit = 25
  ): Promise<AnalyticsSnapshot[]> {
    const baseUrl = `https://graph.facebook.com/v21.0/${this.igUserId}/media`;
    const params = new URLSearchParams({
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,reach,impressions",
      limit: String(limit),
    });

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Instagram API error: ${res.status}`);

    const data = (await res.json()) as { data?: IGMediaItem[] };
    const media = data.data ?? [];

    const snapshots: AnalyticsSnapshot[] = [];
    for (const item of media) {
      const existing = await prisma.analyticsSnapshot.findUnique({
        where: { instagramMediaId: item.id },
      });
      if (existing) continue;

      const postType: ContentType =
        item.media_type === "VIDEO"
          ? "REEL"
          : item.media_type === "CAROUSEL_ALBUM"
          ? "CAROUSEL"
          : "FEED_POST";

      const snapshot = await prisma.analyticsSnapshot.create({
        data: {
          socialAccountId,
          workspaceId,
          instagramMediaId: item.id,
          igShortCode: item.id,
          postUrl: item.permalink ?? null,
          postType,
          caption: item.caption ?? null,
          publishedAt: new Date(item.timestamp),
          likesCount: item.like_count ?? 0,
          commentsCount: item.comments_count ?? 0,
          impressions: item.impressions ?? null,
          reach: item.reach ?? null,
        },
      });

      snapshots.push({
        id: snapshot.id,
        socialAccountId: snapshot.socialAccountId,
        workspaceId: snapshot.workspaceId,
        instagramMediaId: snapshot.instagramMediaId ?? "",
        igShortCode: snapshot.igShortCode ?? "",
        postUrl: snapshot.postUrl ?? "",
        postType: snapshot.postType ?? "FEED_POST",
        caption: snapshot.caption ?? "",
        publishedAt: snapshot.publishedAt ?? new Date(),
        likesCount: snapshot.likesCount,
        commentsCount: snapshot.commentsCount,
        savesCount: snapshot.savesCount,
        sharesCount: snapshot.sharesCount,
        impressions: snapshot.impressions ?? 0,
        reach: snapshot.reach ?? 0,
        plays: snapshot.plays ?? 0,
        followerCount: snapshot.followerCount ?? 0,
        syncedAt: snapshot.syncedAt,
      });
    }

    return snapshots;
  }

  async getSummary(workspaceId: string): Promise<AnalyticsSummary> {
    const dbSnapshots = await prisma.analyticsSnapshot.findMany({
      where: { workspaceId },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    if (dbSnapshots.length === 0) {
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalSaves: 0,
        avgEngagement: 0,
        topPosts: [],
        topFormat: null,
        topHookPattern: null,
        topCtaPattern: null,
        aiSummary: "No posts yet.",
      };
    }

    const totalLikes = dbSnapshots.reduce((sum, s) => sum + s.likesCount, 0);
    const totalComments = dbSnapshots.reduce((sum, s) => sum + s.commentsCount, 0);
    const totalSaves = dbSnapshots.reduce((sum, s) => sum + s.savesCount, 0);
    const avgEngagement =
      dbSnapshots.reduce(
        (sum, s) => sum + s.likesCount + s.commentsCount + s.savesCount,
        0
      ) / dbSnapshots.length;

    const topPosts = [...dbSnapshots]
      .sort(
        (a, b) =>
          b.likesCount + b.commentsCount - (a.likesCount + a.commentsCount)
      )
      .slice(0, 5)
      .map(
        (s): AnalyticsSnapshot => ({
          id: s.id,
          socialAccountId: s.socialAccountId,
          workspaceId: s.workspaceId,
          instagramMediaId: s.instagramMediaId ?? "",
          igShortCode: s.igShortCode ?? "",
          postUrl: s.postUrl ?? "",
          postType: s.postType ?? "FEED_POST",
          caption: s.caption ?? "",
          publishedAt: s.publishedAt ?? new Date(),
          likesCount: s.likesCount,
          commentsCount: s.commentsCount,
          savesCount: s.savesCount,
          sharesCount: s.sharesCount,
          impressions: s.impressions ?? 0,
          reach: s.reach ?? 0,
          plays: s.plays ?? 0,
          followerCount: s.followerCount ?? 0,
          syncedAt: s.syncedAt,
        })
      );

    const formatCounts: Record<string, number> = {};
    for (const s of dbSnapshots) {
      const key = s.postType ?? "FEED_POST";
      formatCounts[key] = (formatCounts[key] ?? 0) + 1;
    }
    const topFormat = (
      Object.entries(formatCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      null
    ) as ContentType | null;

    return {
      totalPosts: dbSnapshots.length,
      totalLikes,
      totalComments,
      totalSaves,
      avgEngagement,
      topPosts,
      topFormat,
      topHookPattern: null,
      topCtaPattern: null,
      aiSummary: "",
    };
  }
}

interface IGMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  impressions?: number;
  reach?: number;
}
