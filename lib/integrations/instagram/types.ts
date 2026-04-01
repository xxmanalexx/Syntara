// Note: MediaType and AccountStatus from @/types/enums can be used by consumers
// of these types when needed.

export interface InstagramOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface InstagramLongLivedTokenResponse extends InstagramTokenResponse {
  refresh_token: string;
}

export interface InstagramUser {
  id: string;
  username: string;
  name?: string;
  account_type: "PERSONAL" | "BUSINESS" | "CREATOR";
  media_count: number;
  biography: string;
  website: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
}

export interface InstagramMedia {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  reach?: number;
  impressions?: number;
}

export interface InstagramCarouselMedia {
  id: string;
  media_type: "IMAGE" | "VIDEO";
  media_url: string;
  thumbnail_url?: string;
}

export interface InstagramMediaInsights {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views?: number;
  engagement: number;
}

export interface InstagramPublishingRequest {
  caption: string;
  imageUrls: string[]; // for feed posts and carousels
  coverImageUrl?: string; // for carousels
  videoUrl?: string; // for reels
  altText?: string;
  locationId?: string;
  userTags?: string[]; // Instagram user IDs to tag
}

export interface InstagramPublishResponse {
  id: string;
  permalink: string;
}

export interface InstagramPage {
  id: string;
  instagram_business_account: {
    id: string;
    username: string;
    name: string;
    profile_picture_url: string;
    followers_count: number;
  };
}
