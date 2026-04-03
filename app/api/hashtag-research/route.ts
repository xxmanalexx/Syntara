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

  if (!query) return NextResponse.json({ hashtags: [], results: [] });

  try {
    const ig = new InstagramInsightsService(socialAccount.accessToken, socialAccount.instagramId ?? "");

    const hashtags = await ig.searchHashtags(query);

    const results = await Promise.all(
      hashtags.slice(0, 5).map(async (hashtag) => {
        try {
          const rawPosts = await ig.getHashtagTopMedia(hashtag.id, 5);
          const posts = rawPosts.map((m: any) => {
            const caption = m.caption ?? "";
            return {
              id: m.id,
              permalink: m.permalink ?? `https://www.instagram.com/p/${m.id}/`,
              caption: caption ? caption.slice(0, 120) + (caption.length > 120 ? "..." : "") : "",
              likeCount: m.like_count ?? 0,
              commentsCount: m.comments_count ?? 0,
              engagement: (m.like_count ?? 0) + (m.comments_count ?? 0),
              formattedLikes: formatCount(m.like_count ?? 0),
              formattedComments: formatCount(m.comments_count ?? 0),
              hashtags: caption ? (caption.match(/#\w+/g) ?? []).slice(0, 10) : [],
            };
          });
          return { hashtag: hashtag.name, posts };
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
