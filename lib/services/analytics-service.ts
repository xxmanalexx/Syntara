import { prisma } from "@/lib/db";
import type { AnalyticsSummary, AnalyticsSnapshot } from "@/types";
import type { ContentType } from "@/types";

const IG_GRAPH_BASE = "https://graph.facebook.com/v21.0";

export class AnalyticsSyncService {
  private accessToken: string;
  private igUserId: string;

  constructor(accessToken: string, igUserId: string) {
    this.accessToken = accessToken;
    this.igUserId = igUserId;
  }

  /**
   * Sync recent media from Instagram → local AnalyticsSnapshot table.
   * Uses upsert so re-running is safe (won't create duplicates).
   */
  async syncRecentMedia(
    workspaceId: string,
    socialAccountId: string,
    limit = 25
  ): Promise<AnalyticsSnapshot[]> {
    // Fetch basic media data (likes + comments on this endpoint)
    const baseUrl = `${IG_GRAPH_BASE}/${this.igUserId}/media`;
    const params = new URLSearchParams({
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
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
      const postType: ContentType =
        item.media_type === "VIDEO"
          ? "REEL"
          : item.media_type === "CAROUSEL_ALBUM"
          ? "CAROUSEL"
          : "FEED_POST";

      const likesCount = item.like_count ?? 0;
      const commentsCount = item.comments_count ?? 0;
      const savesCount = 0;

      // Build base snapshot data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshotData: any = {
        socialAccountId,
        workspaceId,
        instagramMediaId: item.id,
        igShortCode: item.id,
        postUrl: item.permalink ?? null,
        postType,
        caption: item.caption ?? null,
        publishedAt: new Date(item.timestamp),
        likesCount,
        commentsCount,
        savesCount,
      };

      // Try to fetch reach from insights (available for ~14 days post-publish)
      try {
        const insightsRes = await fetch(
          `${IG_GRAPH_BASE}/${item.id}/insights?metric=reach&access_token=${encodeURIComponent(this.accessToken)}`
        );
        if (insightsRes.ok) {
          const insightsData =
            (await insightsRes.json()) as InsightsResponse;
          for (const metric of insightsData.data ?? []) {
            if (metric.name === "reach" && metric.values[0]?.value > 0) {
              snapshotData.reach = metric.values[0].value;
            } else if (metric.name === "impressions" && metric.values[0]?.value > 0) {
              snapshotData.impressions = metric.values[0].value;
            } else if (metric.name === "plays" && metric.values[0]?.value > 0) {
              snapshotData.plays = metric.values[0].value;
            }
          }
        }
      } catch {
        // Non-critical — skip reach data
      }

      // Upsert so we don't duplicate existing records
      const snapshot = await prisma.analyticsSnapshot.upsert({
        where: { instagramMediaId: item.id },
        create: snapshotData,
        update: { likesCount, commentsCount, savesCount },
      });

      // If we got a reach value from insights, update the record
      if (snapshotData.reach !== undefined) {
        await prisma.analyticsSnapshot.update({
          where: { id: snapshot.id },
          data: { reach: snapshotData.reach },
        });
        snapshot.reach = snapshotData.reach;
      }

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

    // Mark posts that no longer exist on Instagram as deleted
    const currentMediaIds = new Set(media.map((m) => m.id));
    if (currentMediaIds.size > 0) {
      await prisma.analyticsSnapshot.updateMany({
        where: {
          socialAccountId,
          instagramMediaId: { notIn: [...currentMediaIds] },
          isDeleted: false,
        },
        data: { isDeleted: true },
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
        totalReach: 0,
        totalImpressions: 0,
        totalPlays: 0,
        avgEngagement: 0,
        followerCount: 0,
        topPosts: [],
        topFormat: null,
        topHookPattern: null,
        topCtaPattern: null,
        aiSummary: "No posts yet.",
      };
    }

    const totalLikes = dbSnapshots.reduce((sum, s) => sum + s.likesCount, 0);
    const totalComments = dbSnapshots.reduce(
      (sum, s) => sum + s.commentsCount,
      0
    );
    const totalSaves = dbSnapshots.reduce(
      (sum, s) => sum + s.savesCount,
      0
    );
    const totalReach = dbSnapshots.reduce(
      (sum, s) => sum + (s.reach ?? 0),
      0
    );
    const totalImpressions = dbSnapshots.reduce(
      (sum, s) => sum + (s.impressions ?? 0),
      0
    );
    const totalPlays = dbSnapshots.reduce(
      (sum, s) => sum + (s.plays ?? 0),
      0
    );
    const totalInteractions =
      totalLikes + totalComments + totalSaves;
    const avgEngagement =
      dbSnapshots.length > 0
        ? (totalInteractions / dbSnapshots.length)
        : 0;

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
      totalReach,
      totalImpressions,
      totalPlays,
      avgEngagement,
      followerCount: 0,
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
  saved_count?: number;
}

interface InsightsResponse {
  data?: { name: string; values: { value: number }[] }[];
}
