import type {
  InstagramOAuthConfig,
  InstagramLongLivedTokenResponse,
  InstagramUser,
  InstagramPage,
} from "./types";

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

export class InstagramAuthService {
  private config: InstagramOAuthConfig;

  constructor(config: InstagramOAuthConfig) {
    this.config = config;
  }

  /**
   * Build the Meta OAuth URL for user authorization.
   * Scopes: instagram_basic, instagram_content_publish, instagram_manage_insights, pages_read_engagement
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      scope: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_insights",
        "pages_read_engagement",
      ].join(","),
      response_type: "code",
    });

    if (state) {
      params.set("state", state);
    }

    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange short-lived token for long-lived token (60-day expiry).
   */
  async exchangeToken(shortLivedToken: string): Promise<InstagramLongLivedTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      grant_type: "fb_exchange_token",
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Token exchange failed: ${response.status}`);
    }

    return response.json() as Promise<InstagramLongLivedTokenResponse>;
  }

  /**
   * Refresh a long-lived token (called before expiry).
   */
  async refreshToken(longLivedToken: string): Promise<InstagramLongLivedTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      grant_type: "fb_exchange_token",
      fb_exchange_token: longLivedToken,
    });

    const response = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Token refresh failed: ${response.status}`);
    }

    return response.json() as Promise<InstagramLongLivedTokenResponse>;
  }

  /**
   * Get Instagram business account linked to a Meta page.
   * Step 1: GET /me/accounts → get page list
   * Step 2: GET /{page-id}?fields=instagram_business_account → get IG account
   */
  async getInstagramAccount(metaAccessToken: string): Promise<InstagramUser> {
    // Step 1: get page list
    const pagesResponse = await fetch(
      `${META_GRAPH_BASE}/me/accounts?access_token=${encodeURIComponent(metaAccessToken)}`
    );

    if (!pagesResponse.ok) {
      const error = await pagesResponse.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Failed to fetch pages: ${pagesResponse.status}`);
    }

    const pagesData = (await pagesResponse.json()) as { data: InstagramPage[] };

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook pages found for this user.");
    }

    // Use the first page that has an Instagram business account
    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `${META_GRAPH_BASE}/${page.id}?fields=instagram_business_account{id,username,name,account_type,media_count,biography,website,profile_picture_url,followers_count,follows_count}&access_token=${encodeURIComponent(metaAccessToken)}`
      );

      if (!igResponse.ok) continue;

      const igData = (await igResponse.json()) as {
        instagram_business_account?: InstagramUser;
      };

      if (igData.instagram_business_account) {
        return igData.instagram_business_account;
      }
    }

    throw new Error("No Instagram business account linked to your Facebook pages.");
  }

  /**
   * Validate if token is still valid.
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${META_GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(accessToken)}`
      );

      if (!response.ok) return false;

      const data = (await response.json()) as { data?: { is_valid?: boolean } };
      return data.data?.is_valid ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Revoke token.
   */
  async revokeToken(accessToken: string): Promise<void> {
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    const response = await fetch(`${META_GRAPH_BASE}/oauth/revoke_credentials?${params.toString()}`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Revoke failed: ${response.status}`);
    }
  }
}
