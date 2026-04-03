import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { InstagramInsightsService } from "@/lib/services/insights-service";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";

  const socialAccount = await prisma.socialAccount.findFirst({
    where: { platform: "INSTAGRAM" },
    orderBy: { createdAt: "desc" },
  });
  if (!socialAccount?.accessToken) {
    return NextResponse.json({ error: "No Instagram account connected" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ hashtags: [], results: [] });
  }

  try {
    const ig = new InstagramInsightsService(socialAccount.accessToken, socialAccount.instagramId ?? "");

    // Search for matching hashtags
    const hashtags = await ig.searchHashtags(query);

    // For each, get top posts by engagement
    const results = await Promise.all(
      hashtags.slice(0, 5).map(async (hashtag) => {
        try {
          const posts = await ig.getHashtagRecentMedia(hashtag.id, 20);
          return {
            hashtag: hashtag.name,
            posts: posts.map((m: any) => ({
              id: m.id,
              permalink: m.permalink,
              caption: m.caption ? m.caption.slice(0, 120) + "..." : "",
              likeCount: m.like_count,
              commentsCount: m.comments_count,
              mediaType: m.media_type,
              timestamp: m.timestamp,
              engagement: m.like_count + m.comments_count,
              formattedLikes: formatCount(m.like_count),
              formattedComments: formatCount(m.comments_count),
              hashtags: m.caption ? (m.caption.match(/#\w+/g) ?? []).slice(0, 10) : [],
            })),
          };
        } catch {
          return { hashtag: hashtag.name, posts: [] };
        }
      })
    );

    return NextResponse.json({ hashtags, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Hashtag search failed" }, { status: 500 });
  }
}
