import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export async function GET(req: Request) {
  let workspaceId: string;

  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    workspaceId = payload.workspaceId as string;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const igAccount = await prisma.socialAccount.findFirst({
    where: {
      workspaceId,
      platform: "INSTAGRAM",
      instagramId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log("[Analytics GET] workspaceId:", workspaceId, "igAccount:", igAccount?.username);

  if (!workspaceId) {
    return NextResponse.json({
      summary: null,
      posts: [],
      weeklyData: [],
    });
  }

  // Fetch snapshots + social account info in parallel
  const [snapshots, igAccountData] = await Promise.all([
    prisma.analyticsSnapshot.findMany({
      where: { socialAccount: { workspaceId }, isDeleted: false },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
    igAccount
      ? prisma.socialAccount.findUnique({
          where: { id: igAccount.id },
          select: { username: true },
        })
      : Promise.resolve(null),
  ]);

  // Compute summary stats
  const totalPosts = snapshots.length;
  const totalLikes = snapshots.reduce((s, r) => s + r.likesCount, 0);
  const totalComments = snapshots.reduce((s, r) => s + r.commentsCount, 0);
  const totalSaves = snapshots.reduce((s, r) => s + (r.savesCount ?? 0), 0);
  const totalReach = snapshots.reduce((s, r) => s + (r.reach ?? 0), 0);
  const totalImpressions = snapshots.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalPlays = snapshots.reduce((s, r) => s + (r.plays ?? 0), 0);

  const totalInteractions = totalLikes + totalComments + totalSaves;
  const avgEngagement =
    totalPosts > 0
      ? +((totalInteractions / totalPosts / 100) * 100).toFixed(2)
      : 0;

  // Format posts for frontend
  const posts = snapshots.map((s) => ({
    id: s.id,
    instagramMediaId: s.instagramMediaId,
    caption: s.caption ?? "",
    postUrl: s.postUrl ?? `https://www.instagram.com/p/${s.igShortCode}/`,
    likesCount: s.likesCount,
    commentsCount: s.commentsCount,
    savesCount: s.savesCount ?? 0,
    reach: s.reach ?? 0,
    impressions: s.impressions ?? 0,
    plays: s.plays ?? 0,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    postType: s.postType ?? "FEED_POST",
    score:
      s.likesCount + s.commentsCount >= 50
        ? 90
        : s.likesCount + s.commentsCount >= 20
        ? 75
        : 55,
  }));

  return NextResponse.json({
    summary: {
      totalPosts,
      totalLikes,
      totalComments,
      totalSaves,
      totalReach,
      totalImpressions,
      totalPlays,
      avgEngagement,
      followerCount: 0,
      igUsername: igAccountData?.username ?? null,
    },
    posts,
    weeklyData: [], // populated by future weekly aggregation
  });
}
