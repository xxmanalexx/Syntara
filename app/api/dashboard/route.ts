import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

async function getWorkspaceId(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.workspaceId as string;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const workspaceId = await getWorkspaceId(req);
  if (!workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all data in parallel
  const [
    publishedCount,
    scheduledCount,
    _nextScheduled,
    recentDrafts,
    recentPublished,
    topPosts,
  ] = await Promise.all([
      // Total published posts
      prisma.draft.count({
        where: { workspaceId, status: "PUBLISHED" },
      }),

      // Scheduled posts count
      prisma.scheduledPost.count({
        where: { workspaceId, publishStatus: "SCHEDULED" },
      }),

      // Next scheduled post time
      prisma.scheduledPost.findFirst({
        where: { workspaceId, publishStatus: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true },
      }),

      // Recent drafts (non-published)
      prisma.draft.findMany({
        where: { workspaceId },
        include: {
          brand: { select: { name: true } },
          mediaAssets: { include: { asset: true }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),

      // Recently published posts (via PublishAttempt)
      prisma.publishAttempt.findMany({
        where: {
          socialAccount: { workspaceId },
          status: "PUBLISHED",
        },
        include: {
          socialAccount: { select: { username: true } },
        },
        orderBy: { attemptedAt: "desc" },
        take: 3,
      }),

      // Top performing by likes (from AnalyticsSnapshot)
      prisma.analyticsSnapshot.findMany({
        where: { workspaceId },
        orderBy: { likesCount: "desc" },
        take: 3,
      }),
    ]);

  // Calculate total reach from analytics snapshots
  const reachSum = await prisma.analyticsSnapshot.aggregate({
    where: { workspaceId },
    _sum: { reach: true, impressions: true },
  });

  // Avg engagement = total interactions / total published
  const engagementData = await prisma.analyticsSnapshot.aggregate({
    where: { workspaceId },
    _sum: { likesCount: true, commentsCount: true, savesCount: true },
    _count: true,
  });

  const totalInteractions =
    (engagementData._sum.likesCount ?? 0) +
    (engagementData._sum.commentsCount ?? 0) +
    (engagementData._sum.savesCount ?? 0);
  const totalPosts = engagementData._count;
  const avgEngagement =
    totalPosts > 0 ? ((totalInteractions / totalPosts / 100) * 100).toFixed(1) : "0";

  // Get the Instagram username for the workspace
  const igAccount = await prisma.socialAccount.findFirst({
    where: { workspaceId, platform: "INSTAGRAM" },
    select: { username: true },
  });

  return NextResponse.json({
    stats: {
      publishedCount,
      scheduledCount,
      nextScheduledAt: null as string | null,
      totalReach: reachSum._sum.reach ?? 0,
      totalImpressions: reachSum._sum.impressions ?? 0,
      avgEngagement: parseFloat(avgEngagement),
    },
    recentDrafts: recentDrafts.map((d) => ({
      id: d.id,
      brandName: d.brand?.name ?? "No brand",
      contentType: d.contentType,
      status: d.status,
      updatedAt: d.updatedAt.toISOString(),
      readinessScore: d.readinessScore ?? 0,
      hasImage: d.mediaAssets.length > 0,
    })),
    recentPublished: recentPublished.map((p) => ({
      id: p.instagramId ?? p.id,
      instagramId: p.instagramId,
      permalink: p.permalink,
      username: p.socialAccount?.username,
      attemptedAt: p.attemptedAt.toISOString(),
    })),
    topPosts: topPosts.map((t) => ({
      id: t.instagramMediaId ?? t.id,
      caption: t.caption ?? "",
      likesCount: t.likesCount,
      commentsCount: t.commentsCount,
      postUrl: t.postUrl ?? (t.igShortCode ? `https://www.instagram.com/p/${t.igShortCode}/` : null),
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
    igUsername: igAccount?.username ?? null,
  });
}
