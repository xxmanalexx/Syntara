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
   * Get top posts for a hashtag, sorted by engagement (likes + comments).
   * Step 1: fetch top_media with only id+like_count (lightweight, avoids timeout)
   * Step 2: batch-fetch captions for the returned post IDs via the ids= endpoint
   */
  async getHashtagTopMedia(hashtagId: string, limit = 9): Promise<any[]> {
    // Step 1: get posts sorted by likes (engagement proxy)
    const data = await this.graphFetch(`/${hashtagId}/top_media`, {
      user_id: this.igUserId,
      fields: "id,like_count,comments_count",
    });

    const posts: any[] = (data.data ?? []).slice(0, limit);

    if (posts.length === 0) return [];

    // Step 2: batch-fetch captions + permalinks in one request
    // The ids= endpoint lets us fetch multiple nodes in one call
    const ids = posts.map((p) => p.id).join(",");
    let captionMap: Record<string, string> = {};
    let permalinkMap: Record<string, string> = {};

    try {
      const batchRes = await this.graphFetch("/", {
        ids,
        fields: "id,caption,permalink",
      });
      captionMap = Object.fromEntries(
        Object.entries(batchRes).map(([id, node]: [string, any]) => [id, node.caption ?? ""])
      );
      permalinkMap = Object.fromEntries(
        Object.entries(batchRes).map(([id, node]: [string, any]) => [id, node.permalink ?? ""])
      );
    } catch {
      // Batch failed — continue with posts that have caption in step 1 (which won't exist)
    }

    return posts.map((p) => ({
      id: p.id,
      like_count: p.like_count,
      comments_count: p.comments_count,
      caption: captionMap[p.id] ?? "",
      permalink: permalinkMap[p.id] ?? "",
    }));
  }
}
