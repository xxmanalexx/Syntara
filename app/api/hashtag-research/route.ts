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

  // Get IG account
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
    const igService = new InstagramInsightsService(socialAccount.accessToken, socialAccount.instagramId ?? "");

    // Search for hashtags matching the query
    const hashtags = await igService.searchHashtags(query);

    // For each hashtag, get top media sorted by engagement
    const results = await Promise.all(
      hashtags.slice(0, 5).map(async (hashtag) => {
        try {
          const topMedia = await igService.getHashtagTopMedia(hashtag.id, 25);
          // Sort by total engagement (likes + comments)
          const sorted = topMedia
            .filter((m: any) => m.media_type !== "VIDEO")
            .sort((a: any, b: any) =>
              (b.like_count + b.comments_count) - (a.like_count + a.comments_count)
            )
            .slice(0, 20)
            .map((m: any) => ({
              id: m.id,
              permalink: m.permalink,
              caption: m.caption ? m.caption.slice(0, 120) + "..." : "",
              likeCount: m.like_count,
              commentsCount: m.comments_count,
              mediaType: m.media_type,
              thumbnail: m.thumbnail_url,
              timestamp: m.timestamp,
              engagement: m.like_count + m.comments_count,
              formattedLikes: formatCount(m.like_count),
              formattedComments: formatCount(m.comments_count),
              hashtags: m.caption ? (m.caption.match(/#\w+/g) ?? []).slice(0, 10) : [],
            }));

          return {
            hashtag: hashtag.name,
            mediaCount: hashtag.mediaCount,
            formattedMediaCount: formatCount(hashtag.mediaCount),
            posts: sorted,
          };
        } catch {
          return { hashtag: hashtag.name, mediaCount: hashtag.mediaCount, formattedMediaCount: formatCount(hashtag.mediaCount), posts: [] };
        }
      })
    );

    return NextResponse.json({ hashtags, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Hashtag search failed" }, { status: 500 });
  }
}
