import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

async function getUserFromToken(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; workspaceId?: string };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const payload = await getUserFromToken(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.sub;
  const userWorkspaceId = payload.workspaceId;

  // Find the Instagram account linked to this user
  // Prefer the one in the user's own workspace (siliconvalleyhub), fall back to any
  const igAccount = await prisma.socialAccount.findFirst({
    where: {
      userId,
      platform: "INSTAGRAM",
      instagramId: { not: null },
      // Ensure we pick an account whose workspaceId matches the user's JWT workspace
      workspaceId: userWorkspaceId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  // Fall back: find any IG account for this user (ignore workspaceId mismatch)
  const account = igAccount ?? await prisma.socialAccount.findFirst({
    where: { userId, platform: "INSTAGRAM", instagramId: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  // Use the account's workspaceId as the authoritative workspace for all data queries
  const workspaceId = account?.workspaceId ?? userWorkspaceId;

  if (!workspaceId) {
    return NextResponse.json({
      stats: { publishedCount: 0, scheduledCount: 0, totalReach: 0, totalImpressions: 0, avgEngagement: 0 },
      recentDrafts: [],
      recentPublished: [],
      topPosts: [],
      igUsername: null,
    });
  }

  // Fetch all data in parallel
  const [
    publishedCount,
    scheduledCount,
    recentDrafts,
    recentPublished,
    topPosts,
    engagementData,
    reachSum,
  ] = await Promise.all([
    // Total published posts
    prisma.draft.count({ where: { workspaceId, status: "PUBLISHED" } }),

    // Scheduled posts count
    prisma.scheduledPost.count({ where: { workspaceId, publishStatus: "SCHEDULED" } }),

    // Recent drafts
    prisma.draft.findMany({
      where: { workspaceId },
      include: { brand: { select: { name: true } }, mediaAssets: { include: { asset: true }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),

    // Recently published via PublishAttempt
    prisma.publishAttempt.findMany({
      where: { socialAccount: { workspaceId }, status: "PUBLISHED" },
      include: { socialAccount: { select: { username: true } } },
      orderBy: { attemptedAt: "desc" },
      take: 3,
    }),

    // Top performing posts
    prisma.analyticsSnapshot.findMany({
      where: { socialAccount: { workspaceId } },
      orderBy: { likesCount: "desc" },
      take: 3,
    }),

    // Engagement totals
    prisma.analyticsSnapshot.aggregate({
      where: { socialAccount: { workspaceId } },
      _sum: { likesCount: true, commentsCount: true, savesCount: true },
      _count: true,
    }),

    // Reach totals
    prisma.analyticsSnapshot.aggregate({
      where: { socialAccount: { workspaceId } },
      _sum: { reach: true, impressions: true },
    }),
  ]);

  const totalInteractions =
    (engagementData._sum.likesCount ?? 0) +
    (engagementData._sum.commentsCount ?? 0) +
    (engagementData._sum.savesCount ?? 0);
  const avgEngagement =
    engagementData._count > 0
      ? +((totalInteractions / engagementData._count / 100) * 100).toFixed(1)
      : 0;

  return NextResponse.json({
    stats: {
      publishedCount,
      scheduledCount,
      totalReach: reachSum._sum.reach ?? 0,
      totalImpressions: reachSum._sum.impressions ?? 0,
      avgEngagement,
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
      postUrl: t.postUrl ?? null,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
    igUsername: igAccount?.username ?? null,
  });
}
