export class InstagramInsightsService {
  constructor(
    private accessToken: string,
    private igUserId: string
  ) {}

  private async graphFetch(path: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`https://graph.facebook.com/v19.0${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? "Graph API error");
    return data;
  }

  /** Search for hashtags matching a keyword */
  async searchHashtags(keyword: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this.graphFetch("/ig_hashtag_search", {
      user_id: this.igUserId,
      q: keyword.replace("#", ""),
    });
    const results: Array<{ id: string; name: string }> = [];
    for (const item of data.data ?? []) {
      try {
        const info = await this.graphFetch(`/${item.id}`, { fields: "id,name" });
        results.push({ id: item.id, name: info.name ?? keyword });
      } catch {
        results.push({ id: item.id, name: keyword });
      }
    }
    return results;
  }

  /**
   * Get top posts for a hashtag sorted by engagement (likes + comments).
   * Uses top_media with id+like_count+comments_count only — caption field is excluded
   * because it causes timeouts at any meaningful limit.
   * Returns posts with permalink constructed from the media ID.
   */
  async getHashtagTopMedia(hashtagId: string, limit = 12): Promise<any[]> {
    const data = await this.graphFetch(`/${hashtagId}/top_media`, {
      user_id: this.igUserId,
      fields: "id,like_count,comments_count",
    });
    return (data.data ?? []).slice(0, limit).map((p: any) => ({
      id: p.id,
      likeCount: p.like_count ?? 0,
      commentsCount: p.comments_count ?? 0,
      engagement: (p.like_count ?? 0) + (p.comments_count ?? 0),
      permalink: `https://www.instagram.com/p/${p.id}/`,
      caption: "",
      hashtags: [],
    }));
  }
}
