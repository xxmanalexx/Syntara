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

  async syncRecentMedia(workspaceId: string, socialAccountId: string, limit = 25): Promise<AnalyticsSnapshot[]> {
    // Fetch recent media from Instagram Graph API
    const baseUrl = `https://graph.facebook.com/v21.0/${this.igUserId}/media`;
    const params = new URLSearchParams({
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,reach,impressions",
      limit: String(limit),
    });

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!res.ok) throw new Error(`Instagram API error: ${res.status}`);

    const data = await res.json();
    const media = data.data ?? [];

    const snapshots: AnalyticsSnapshot[] = [];

    for (const item of media) {
      const existing = await prisma.analyticsSnapshot.findUnique({
        where: { instagramMediaId: item.id },
      });
      if (existing) continue;

      const snapshot = await prisma.analyticsSnapshot.create({
        data: {
          socialAccountId,
          workspaceId,
          instagramMediaId: item.id,
          igShortCode: item.id,
          postUrl: item.permalink,
          postType: item.media_type === "VIDEO" ? "REEL" : item.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL" : "FEED_POST",
          caption: item.caption ?? null,
          publishedAt: new Date(item.timestamp),
          likesCount: item.like_count ?? 0,
          commentsCount: item.comments_count ?? 0,
          impressions: item.impressions ?? null,
          reach: item.reach ?? null,
        },
      });
      snapshots.push(snapshot as unknown as AnalyticsSnapshot);
    }

    return snapshots;
  }

  async getSummary(workspaceId: string): Promise<AnalyticsSummary> {
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { workspaceId },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    if (snapshots.length === 0) {
      return {
        totalPosts: 0, totalLikes: 0, totalComments: 0, totalSaves: 0,
        avgEngagement: 0, topPosts: [], topFormat: null,
        topHookPattern: null, topCtaPattern: null, aiSummary: "No posts yet.",
      };
    }

    const totalLikes = snapshots.reduce((s: number, a: AnalyticsSnapshot) => s + a.likesCount, 0);
    const totalComments = snapshots.reduce((s: number, a: AnalyticsSnapshot) => s + a.commentsCount, 0);
    const totalSaves = snapshots.reduce((s: number, a: AnalyticsSnapshot) => s + a.savesCount, 0);
    const avgEngagement = snapshots.reduce((s: number, a: AnalyticsSnapshot) => {
      const total = a.likesCount + a.commentsCount + a.savesCount;
      return s + total;
    }, 0) / snapshots.length;

    const topPosts = [...snapshots]
      .sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount))
      .slice(0, 5);

    const formatCounts: Record<string, number> = {};
    for (const s of snapshots) {
      formatCounts[s.postType] = (formatCounts[s.postType] ?? 0) + 1;
    }
    const topFormat = (Object.entries(formatCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null) as ContentType | null;

    return {
      totalPosts: snapshots.length,
      totalLikes,
      totalComments,
      totalSaves,
      avgEngagement,
      topPosts: topPosts as unknown as AnalyticsSnapshot[],
      topFormat,
      topHookPattern: null,
      topCtaPattern: null,
      aiSummary: "", // populated by Ollama
    };
  }
}
