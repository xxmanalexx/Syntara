import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { getOrCreateContact } from "@/lib/domain/inbox/service";
import { leadOrchestrator } from "@/lib/services/ollama-agent";

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
  created_at: string | number; // Unix timestamp (seconds) or ISO string
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
    const url = `${INSTAGRAM_API}/${this.igAccountId}/media?fields=id,caption,comments_count,timestamp,permalink&access_token=${this.accessToken}&limit=${limit}`;
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

        // Idempotency — skip if already handled by webhook (check message_id match)
        if (await prisma.message.findUnique({ where: { message_id: comment.id } })) {
          continue;
        }

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
        const postPermalink = (post as IgMediaItem & { permalink?: string }).permalink ?? null;

        // Check if conversation already has IG post info
        const existingConv = await prisma.conversation.findUnique({
          where: { platform_conversation_id: convId },
          select: { ig_media_id: true },
        });

        const conversation = await prisma.conversation.upsert({
          where: { platform_conversation_id: convId },
          create: {
            workspaceId: this.workspaceId,
            contactId: contact.id,
            channel: "INSTAGRAM",
            platform_conversation_id: convId,
            ig_media_id: post.id,
            ig_post_caption: post.caption ?? null,
            ig_post_permalink: postPermalink,
          },
          update: existingConv?.ig_media_id
            ? {}
            : {
                ig_media_id: post.id,
                ig_post_caption: post.caption ?? null,
                ig_post_permalink: postPermalink,
              },
        });

        // Store the message
        const savedMessage = await prisma.message.create({
          data: {
            workspaceId: this.workspaceId,
            conversationId: conversation.id,
            contactId: contact.id,
            direction: "INBOUND",
            content: comment.text,
            message_id: comment.id,
            instagram_media_id: post.id,
            status: "DELIVERED",
            raw_payload: { postCaption: post.caption ?? "", likeCount: comment.like_count, commenterUsername: comment.from.username },
          },
        });

        // Update conversation preview — guard against invalid dates
        const commentDate = (() => {
          const raw = comment.created_at;
          if (!raw) return new Date();
          if (typeof raw === "number") return new Date(raw * 1000);
          const parsed = new Date(raw);
          return isNaN(parsed.getTime()) ? new Date() : parsed;
        })();

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            last_message_at: commentDate,
            last_message_preview: comment.text.slice(0, 100),
            unread_count: { increment: 1 },
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

        // Run AI orchestrator (generate reply suggestion)
        try {
          await leadOrchestrator.processInboundMessage(conversation.id, savedMessage.id);
        } catch (err) {
          console.error("[CommentPolling] Orchestrator error:", err);
        }

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
    let accessToken: string;
    try {
      accessToken = decryptToken(account.accessToken);
    } catch {
      console.warn(`[CommentPolling] Failed to decrypt token for workspace ${account.workspaceId}, skipping`);
      continue;
    }
    try {
      const service = new CommentPollingService(
        accessToken,
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
