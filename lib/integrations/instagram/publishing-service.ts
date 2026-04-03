import type {
  InstagramMedia,
  InstagramMediaInsights,
  InstagramPublishResponse,
  InstagramPublishingRequest,
} from "./types";

const IG_GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface ContainerStatusResponse {
  status: string;
}

interface PaginatedMediaResponse {
  data: InstagramMedia[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

export class InstagramPublishingService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Publish a single-image feed post.
   * @param igUserIdOverride - pass to skip the /me/accounts lookup (recommended)
   */
  async publishFeedPost(
    req: { imageUrl: string; caption: string; altText?: string },
    igUserIdOverride?: string
  ): Promise<InstagramPublishResponse> {
    // Prefer override (stored instagramId), only fallback to /me/accounts if not provided
    const igUserId = igUserIdOverride ?? await this.resolveIgUserId().catch(() => igUserIdOverride ?? "");
    if (!igUserId) throw new Error("No Instagram User ID available. Please re-connect your Instagram account.");
    const publishReq: InstagramPublishingRequest = {
      caption: req.caption,
      imageUrls: [req.imageUrl],
      altText: req.altText,
    };
    const containerId = await this.createMediaContainer(igUserId, publishReq);
    return this.waitForPublish(containerId, igUserId);
  }

  /**
   * Publish a carousel post (multiple images).
   */
  async publishCarousel(req: {
    imageUrls: string[];
    caption: string;
    coverIndex?: number;
    altText?: string;
  }, igUserIdOverride?: string): Promise<InstagramPublishResponse> {
    if (req.imageUrls.length < 2 || req.imageUrls.length > 10) {
      throw new Error("Carousel must have between 2 and 10 images.");
    }

    const igUserId = igUserIdOverride ?? await this.resolveIgUserId().catch(() => igUserIdOverride ?? "");
    if (!igUserId) throw new Error("No Instagram User ID available. Please re-connect your Instagram account.");

    // Create child media containers first
    const childIds: string[] = [];
    for (const imageUrl of req.imageUrls) {
      const childReq: InstagramPublishingRequest = {
        caption: "",
        imageUrls: [imageUrl],
      };
      const childId = await this.createMediaContainer(igUserId, childReq);
      childIds.push(childId);
    }

    // Wait for all children to be ready
    await Promise.all(childIds.map((id) => this.waitForContainerReady(id, igUserId)));

    // Create carousel container with children
    const carouselParams = new URLSearchParams({
      access_token: this.accessToken,
      caption: req.caption,
      media_type: "CAROUSEL",
      children: childIds.join(","),
    });

    if (req.coverIndex !== undefined) {
      carouselParams.set("carousel_folder", req.imageUrls[req.coverIndex]);
    }
    if (req.altText) {
      carouselParams.set("alt_text", req.altText);
    }

    const carouselResponse = await fetch(
      `${IG_GRAPH_BASE}/${igUserId}/media?${carouselParams.toString()}`,
      { method: "POST" }
    );

    await this.handleRateLimit(carouselResponse);

    if (!carouselResponse.ok) {
      const error = await carouselResponse.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Carousel container creation failed: ${carouselResponse.status}`);
    }

    const carouselData = (await carouselResponse.json()) as { id: string };
    return this.waitForPublish(carouselData.id, igUserId);
  }

  /**
   * Publish a reel (video).
   */
  async publishReel(req: {
    videoUrl: string;
    caption: string;
    coverImageUrl?: string;
  }): Promise<InstagramPublishResponse> {
    const igUserId = await this.resolveIgUserId();

    // Step 1: Upload video to Meta's video API to get a video ID / URL
    const videoUploadResponse = await fetch(
      `${IG_GRAPH_BASE}/${igUserId}/media?media_type=REELS&access_token=${encodeURIComponent(this.accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: req.videoUrl,
          caption: req.caption,
          ...(req.coverImageUrl && { cover_image_url: req.coverImageUrl }),
        }),
      }
    );

    await this.handleRateLimit(videoUploadResponse);

    if (!videoUploadResponse.ok) {
      const error = await videoUploadResponse.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Reel upload failed: ${videoUploadResponse.status}`);
    }

    const reelData = (await videoUploadResponse.json()) as { id: string };
    return this.waitForPublish(reelData.id, igUserId);
  }

  /**
   * Publish a story (image).
   */
  async publishStory(req: {
    imageUrl: string;
    stickerConfig?: Record<string, unknown>;
  }, igUserIdOverride?: string): Promise<InstagramPublishResponse> {
    const igUserId = igUserIdOverride ?? await this.resolveIgUserId().catch(() => igUserIdOverride ?? "");
    if (!igUserId) throw new Error("No Instagram User ID available. Please re-connect your Instagram account.");

    const storyParams = new URLSearchParams({
      access_token: this.accessToken,
      media_type: "STORIES",
      image_url: req.imageUrl,
    });

    // Append any sticker config params (stickers, mentions, etc.)
    if (req.stickerConfig) {
      for (const [key, value] of Object.entries(req.stickerConfig)) {
        if (value !== undefined) {
          storyParams.set(key, String(value));
        }
      }
    }

    const storyResponse = await fetch(
      `${IG_GRAPH_BASE}/${igUserId}/media?${storyParams.toString()}`,
      { method: "POST" }
    );

    await this.handleRateLimit(storyResponse);

    if (!storyResponse.ok) {
      const error = await storyResponse.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Story creation failed: ${storyResponse.status}`);
    }

    const storyData = (await storyResponse.json()) as { id: string };
    return this.waitForPublish(storyData.id, igUserId);
  }

  /**
   * Get media container status (after creating container, before published).
   */
  async getContainerStatus(containerId: string): Promise<{
    status: string;
  }> {
    const response = await fetch(
      `${IG_GRAPH_BASE}/${containerId}?fields=status&access_token=${encodeURIComponent(this.accessToken)}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Failed to get container status: ${response.status}`);
    }

    const data = (await response.json()) as ContainerStatusResponse;
    return {
      status: data.status,
    };
  }

  /**
   * Fetch published media details.
   */
  async getMedia(mediaId: string): Promise<InstagramMedia> {
    const fields = [
      "id",
      "caption",
      "media_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "timestamp",
      "like_count",
      "comments_count",
      "insights{impressions,reach,likes,comments,saves,shares,views,engagement}",
    ].join(",");

    const response = await fetch(
      `${IG_GRAPH_BASE}/${mediaId}?fields=${fields}&access_token=${encodeURIComponent(this.accessToken)}`
    );

    await this.handleRateLimit(response);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Failed to fetch media: ${response.status}`);
    }

    return response.json() as Promise<InstagramMedia>;
  }

  /**
   * Fetch media insights.
   */
  async getMediaInsights(mediaId: string): Promise<InstagramMediaInsights> {
    const response = await fetch(
      `${IG_GRAPH_BASE}/${mediaId}/insights?metric=impressions,reach,likes,comments,saves,shares,views,engagement&access_token=${encodeURIComponent(this.accessToken)}`
    );

    await this.handleRateLimit(response);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Failed to fetch insights: ${response.status}`);
    }

    const data = (await response.json()) as { data: Array<{ name: string; values: Array<{ value: number }> }> };

    const insights: InstagramMediaInsights = {
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
      engagement: 0,
    };

    for (const metric of data.data) {
      const value = metric.values[0]?.value ?? 0;
      switch (metric.name) {
        case "impressions": insights.impressions = value; break;
        case "reach": insights.reach = value; break;
        case "likes": insights.likes = value; break;
        case "comments": insights.comments = value; break;
        case "saves": insights.saves = value; break;
        case "shares": insights.shares = value; break;
        case "views": insights.views = value; break;
        case "engagement": insights.engagement = value; break;
      }
    }

    return insights;
  }

  /**
   * Fetch all media (paginated).
   */
  async getMediaList(params?: { limit?: number; after?: string }): Promise<{
    media: InstagramMedia[];
    hasNextPage: boolean;
    cursor?: string;
  }> {
    const queryParams = new URLSearchParams({ fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count" });
    if (params?.limit) queryParams.set("limit", String(params.limit));
    if (params?.after) queryParams.set("after", params.after);
    queryParams.set("access_token", this.accessToken);

    const response = await fetch(`${IG_GRAPH_BASE}/me/media?${queryParams.toString()}`);

    await this.handleRateLimit(response);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Failed to fetch media list: ${response.status}`);
    }

    const data = (await response.json()) as PaginatedMediaResponse;

    return {
      media: data.data,
      hasNextPage: !!data.paging?.next,
      cursor: data.paging?.cursors?.after,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Resolve the Instagram Business Account ID from the access token.
   * Caches based on the token — callers pass the igUserId explicitly after.
   */
  private async resolveIgUserId(): Promise<string> {
    const response = await fetch(
      `${IG_GRAPH_BASE}/me/accounts?fields=instagram_business_account&id&access_token=${encodeURIComponent(this.accessToken)}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message ?? `Failed to resolve IG user ID: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: Array<{ instagram_business_account?: { id: string } }>;
    };

    const igAccount = data.data[0]?.instagram_business_account;
    if (!igAccount) {
      throw new Error("Could not resolve Instagram Business Account ID from token.");
    }

    return igAccount.id;
  }

  /**
   * Create a media container (image or video) — first step of two-step publish.
   */
  private async createMediaContainer(
    igUserId: string,
    req: InstagramPublishingRequest
  ): Promise<string> {
    const params = new URLSearchParams({ access_token: this.accessToken });

    // Determine media type
    const isVideo = !!req.videoUrl;
    params.set("media_type", isVideo ? "VIDEO" : "IMAGE");

    if (req.imageUrls[0]) params.set("image_url", req.imageUrls[0]);
    if (req.videoUrl) params.set("video_url", req.videoUrl);
    if (req.caption) params.set("caption", req.caption);
    if (req.altText) params.set("alt_text", req.altText);
    if (req.locationId) params.set("location_id", req.locationId);
    if (req.coverImageUrl) params.set("cover_image_url", req.coverImageUrl);

    // User tags: comma-separated IG user IDs
    if (req.userTags && req.userTags.length > 0) {
      params.set("user_tags", req.userTags.join(","));
    }

    const response = await fetch(
      `${IG_GRAPH_BASE}/${igUserId}/media?${params.toString()}`,
      { method: "POST" }
    );

    await this.handleRateLimit(response);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error?.error?.message ?? `Media container creation failed: ${response.status}`
      );
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  /**
   * Wait for a media container to transition to "finished" status, then publish.
   * Instagram processes containers asynchronously; this polls until done.
   */
  private async waitForPublish(
    containerId: string,
    igUserId: string,
    maxWaitMs = 120_000
  ): Promise<InstagramPublishResponse> {
    const start = Date.now();
    const interval = 3000;

    while (Date.now() - start < maxWaitMs) {
      const status = await this.getContainerStatus(containerId);

      const containerStatus = status.status;
      if (containerStatus === "finished" || containerStatus.startsWith("Finished")) {
        // Publish the finished container
        const publishResponse = await fetch(
          `${IG_GRAPH_BASE}/${igUserId}/media_publish?access_token=${encodeURIComponent(this.accessToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creation_id: containerId }),
          }
        );

        await this.handleRateLimit(publishResponse);

        if (!publishResponse.ok) {
          const error = await publishResponse.json().catch(() => ({}));
          throw new Error(
            error?.error?.message ?? `Media publish failed: ${publishResponse.status}`
          );
        }

        const publishedData = (await publishResponse.json()) as { id: string };

        // Fetch permalink
        const mediaResponse = await fetch(
          `${IG_GRAPH_BASE}/${publishedData.id}?fields=permalink&access_token=${encodeURIComponent(this.accessToken)}`
        );

        const mediaData = (await mediaResponse.json()) as { permalink: string };

        return { id: publishedData.id, permalink: mediaData.permalink };
      }

      if (status.status === "error") {
        throw new Error("Container publish error");
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error("Timed out waiting for media container to finish processing.");
  }

  /**
   * Wait for a child container to finish (used in carousel creation).
   */
  private async waitForContainerReady(containerId: string, igUserId: string): Promise<void> {
    const maxWaitMs = 120_000;
    const start = Date.now();
    const interval = 3000;

    while (Date.now() - start < maxWaitMs) {
      const status = await this.getContainerStatus(containerId);

      const s = status.status;
      if (s === "finished" || s.startsWith("Finished")) return;
      if (status.status === "error") {
        throw new Error("Child container error");
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Timed out waiting for child container ${containerId}.`);
  }

  /**
   * Handle rate limiting — reads Retry-After header and waits if necessary.
   */
  private async handleRateLimit(response: Response): Promise<void> {
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
