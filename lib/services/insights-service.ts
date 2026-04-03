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
   * Get top posts for a hashtag sorted by engagement.
   * Tries top_media first (sorted by IG algorithm). Falls back to
   * recent_media if top_media returns 0 posts.
   * Uses caption field — reliable up to ~20 posts.
   * Returns posts with numeric ID URL (https://www.instagram.com/p/{id}/).
   */
  async getHashtagTopMedia(hashtagId: string, limit = 20): Promise<any[]> {
    try {
      const data = await this.graphFetch(`/${hashtagId}/top_media`, {
        user_id: this.igUserId,
        fields: "id,like_count,comments_count,caption",
      });
      const posts = data.data ?? [];
      if (posts.length > 0) return this.mapPosts(posts);
    } catch (err: any) {
      // top_media failed — fall through to recent_media
    }

    // Fallback: recent posts (chronological, may have low engagement)
    try {
      const data = await this.graphFetch(`/${hashtagId}/recent_media`, {
        user_id: this.igUserId,
        fields: "id,like_count,comments_count,caption",
      });
      return (data.data ?? []).slice(0, limit).map((p: any) => ({
        id: p.id,
        likeCount: p.like_count ?? 0,
        commentsCount: p.comments_count ?? 0,
        engagement: (p.like_count ?? 0) + (p.comments_count ?? 0),
        caption: p.caption ?? "",
        permalink: "https://www.instagram.com/p/" + p.id + "/",
        hashtags: (p.caption?.match(/#\w+/g) ?? []).slice(0, 10),
      }));
    } catch {
      return [];
    }
  }

  private mapPosts(data: any[]): any[] {
    return data.map((p: any) => ({
      id: p.id,
      likeCount: p.like_count ?? 0,
      commentsCount: p.comments_count ?? 0,
      engagement: (p.like_count ?? 0) + (p.comments_count ?? 0),
      caption: p.caption ?? "",
      permalink: "https://www.instagram.com/p/" + p.id + "/",
      hashtags: (p.caption?.match(/#\w+/g) ?? []).slice(0, 10),
    }));
  }
}
