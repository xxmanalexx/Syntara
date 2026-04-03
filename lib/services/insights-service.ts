export class InstagramInsightsService {
  constructor(
    private accessToken: string,
    private igUserId: string
  ) {}

  private async igFetch(path: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`https://graph.instagram.com${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? "IG API error");
    return data;
  }

  /** Search for hashtags by keyword */
  async searchHashtags(keyword: string): Promise<Array<{ id: string; name: string; mediaCount: number }>> {
    const data = await this.igFetch(`/${this.igUserId}/ig_hashtags`, {
      search: keyword.replace("#", ""),
      fields: "id,name,media_count",
    });
    return (data.data ?? []).map((h: any) => ({
      id: h.id,
      name: h.name,
      mediaCount: h.media_count ?? 0,
    }));
  }

  /** Get top media for a hashtag (sorted by engagement) */
  async getHashtagTopMedia(hashtagId: string, limit = 25): Promise<any[]> {
    const data = await this.igFetch(`/${hashtagId}/top_media`, {
      user_id: this.igUserId,
      fields: `id,caption,like_count,comments_count,permalink,media_type,timestamp,thumbnail_url,children{id,thumbnail_url,media_type}`,
    });
    return data.data ?? [];
  }

  /** Get recent media for a hashtag */
  async getHashtagRecentMedia(hashtagId: string, limit = 25): Promise<any[]> {
    const data = await this.igFetch(`/${hashtagId}/recent_media`, {
      user_id: this.igUserId,
      fields: `id,caption,like_count,comments_count,permalink,media_type,timestamp,thumbnail_url,children{id,thumbnail_url,media_type}`,
    });
    return data.data ?? [];
  }
}
