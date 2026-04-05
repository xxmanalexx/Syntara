import { prisma } from "@/lib/db";
import { getOrCreateContact } from "@/lib/domain/inbox/service";

const INSTAGRAM_API = "https://graph.facebook.com/v19.0";

interface IgMediaItem {
  id: string;
  caption?: string;
  comments_count?: number;
  timestamp?: string;
}

interface IgComment {
  id: string;
  text: string;
  from: { id: string; username: string };
  created_at: string;
  like_count: number;
}

interface IgCommentResponse {
  data: IgComment[];
  paging?: { cursors?: { after?: string } };
}

export class CommentPollingService {
  constructor(
    private accessToken: string,
    private igAccountId: string,
    private workspaceId: string
  ) {}

  private async fetchMedia(limit = 25): Promise<IgMediaItem[]> {
    const url = `${INSTAGRAM_API}/${this.igAccountId}/media?fields=id,caption,comments_count,timestamp&access_token=${this.accessToken}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
  }

  private async fetchComments(mediaId: string): Promise<IgComment[]> {
    const url = `${INSTAGRAM_API}/${mediaId}/comments?fields=id,text,from,created_at,like_count&access_token=${this.accessToken}&limit=50`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: IgCommentResponse = await res.json();
    return data.data ?? [];
  }

  async pollComments(): Promise<{ postsChecked: number; newComments: number }> {
    const media = await this.fetchMedia();
    let newComments = 0;

    for (const post of media) {
      const comments = await this.fetchComments(post.id);

      for (const comment of comments) {
        const alreadyHandled = await prisma.channelWebhookEvent.findUnique({
          where: { event_id: `comment_${comment.id}` },
        });
        if (alreadyHandled) continue;

        // Create or get contact
        const contact = await getOrCreateContact(
          this.workspaceId,
          comment.from.id,
          comment.from.username,
          null, // profileImageUrl
          comment.from.id, // instagramId
        );

        // Create or get conversation (one per post per contact)
        const convId = `${this.workspaceId}_${post.id}_${comment.from.id}`;
        const conversation = await prisma.conversation.upsert({
          where: { platform_conversation_id: convId },
          create: {
            workspaceId: this.workspaceId,
            contactId: contact.id,
            channel: "INSTAGRAM",
            platform_conversation_id: convId,
          },
          update: {},
        });

        // Store the message
        await prisma.message.create({
          data: {
            workspaceId: this.workspaceId,
            conversationId: conversation.id,
            contactId: contact.id,
            direction: "INBOUND",
            content: comment.text,
            message_id: comment.id,
            instagram_media_id: post.id,
            raw_payload: { postCaption: post.caption ?? "", likeCount: comment.like_count, commenterUsername: comment.from.username },
          },
        });

        // Mark event as handled
        await prisma.channelWebhookEvent.create({
          data: {
            workspaceId: this.workspaceId,
            platform: "INSTAGRAM",
            event_type: "comment_received",
            event_id: `comment_${comment.id}`,
            raw_payload: { mediaId: post.id, commentText: comment.text, from: comment.from },
          },
        });

        newComments++;
      }
    }

    return { postsChecked: media.length, newComments };
  }
}

/**
 * Run comment polling for all workspaces with connected IG accounts.
 * Called by the cron worker on a schedule.
 */
export async function runCommentPolling(): Promise<{ workspaces: number; newComments: number }> {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "INSTAGRAM", instagramId: { not: null }, accessToken: { not: null } },
    select: { workspaceId: true, instagramId: true, accessToken: true },
  });

  let totalNew = 0;
  for (const account of accounts) {
    if (!account.instagramId || !account.accessToken) continue;
    try {
      const service = new CommentPollingService(
        account.accessToken,
        account.instagramId,
        account.workspaceId
      );
      const result = await service.pollComments();
      totalNew += result.newComments;
      console.log(`[CommentPolling] workspace ${account.workspaceId}: ${result.newComments} new comments from ${result.postsChecked} posts`);
    } catch (err) {
      console.error(`[CommentPolling] Error for workspace ${account.workspaceId}:`, err);
    }
  }

  return { workspaces: accounts.length, newComments: totalNew };
}
