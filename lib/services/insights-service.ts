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

  /** Search for hashtags by keyword — returns array of { id, name } */
  async searchHashtags(keyword: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this.graphFetch("/ig_hashtag_search", {
      user_id: this.igUserId,
      q: keyword.replace("#", ""),
    });
    const results: Array<{ id: string; name: string }> = [];
    for (const item of data.data ?? []) {
      try {
        // Fetch each hashtag's name
        const info = await this.graphFetch(`/${item.id}`, { fields: "id,name" });
        results.push({ id: item.id, name: info.name ?? keyword });
      } catch {
        results.push({ id: item.id, name: keyword });
      }
    }
    return results;
  }

  /** Get recent media for a hashtag — returns posts sorted by engagement */
  async getHashtagRecentMedia(hashtagId: string, limit = 25): Promise<any[]> {
    const data = await this.graphFetch(`/${hashtagId}/recent_media`, {
      user_id: this.igUserId,
      fields: "id,caption,like_count,comments_count,permalink,media_type,timestamp",
    });

    return (data.data ?? [])
      .filter((m: any) => m.media_type !== "VIDEO")
      .sort((a: any, b: any) =>
        (b.like_count + b.comments_count) - (a.like_count + a.comments_count)
      )
      .slice(0, limit);
  }
}
