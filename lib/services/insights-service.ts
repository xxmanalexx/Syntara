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
   * Uses top_media with id+like_count+comments_count+caption (limit 5 to avoid timeout).
   * Falls back to id+like_count only if caption field times out.
   */
  async getHashtagTopMedia(hashtagId: string, limit = 5): Promise<any[]> {
    // Try with caption first (preferred)
    try {
      const data = await this.graphFetch(`/${hashtagId}/top_media`, {
        user_id: this.igUserId,
        fields: "id,like_count,comments_count,caption",
      });
      return (data.data ?? []).slice(0, limit);
    } catch (err: any) {
      // Fallback: caption field caused timeout — get engagement metrics without caption
      if (err.message?.includes("reduce") || err.message?.includes("timeout")) {
        const data = await this.graphFetch(`/${hashtagId}/top_media`, {
          user_id: this.igUserId,
          fields: "id,like_count,comments_count",
        });
        return (data.data ?? []).slice(0, limit).map((p: any) => ({
          ...p,
          caption: "",
        }));
      }
      throw err;
    }
  }
}
