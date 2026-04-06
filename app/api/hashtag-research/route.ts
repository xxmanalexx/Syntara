import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
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

  let accessToken: string;
  try {
    accessToken = decryptToken(socialAccount.accessToken);
  } catch {
    return NextResponse.json({ error: "Instagram token invalid — please reconnect" }, { status: 400 });
  }

  if (!query) return NextResponse.json({ hashtags: [], results: [] });

  try {
    const ig = new InstagramInsightsService(accessToken, socialAccount.instagramId ?? "");

    const hashtags = await ig.searchHashtags(query);

    const results = await Promise.all(
      hashtags.slice(0, 5).map(async (hashtag) => {
        try {
          const rawPosts = await ig.getHashtagTopMedia(hashtag.id, 6);
          const posts = rawPosts.map((m: any) => ({
            id: m.id,
            permalink: m.permalink,
            caption: m.caption ?? "",
            likeCount: m.likeCount ?? 0,
            commentsCount: m.commentsCount ?? 0,
            engagement: m.engagement ?? 0,
            formattedLikes: formatCount(m.likeCount ?? 0),
            formattedComments: formatCount(m.commentsCount ?? 0),
            hashtags: m.hashtags ?? [],
          }));
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
