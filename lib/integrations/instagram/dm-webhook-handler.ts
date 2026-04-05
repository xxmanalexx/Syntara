import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { upsertConversationFromWebhook } from "@/lib/domain/inbox/service";
import { leadOrchestrator } from "@/lib/services/ollama-agent";
import { createLead, logActivity } from "@/lib/domain/leads/service";
import { getOrCreatePipeline } from "@/lib/domain/leads/pipeline-service";
import type { ChannelType } from "@prisma/client";

interface InstagramMessageEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: string;
  message: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload: { url?: string; sticker_id?: string };
    }>;
  };
}

interface InstagramMessagingEntry {
  id: string; // IG Scoped ID
  time: number;
  messaging?: InstagramMessageEvent[];
  changes?: Array<{
    field: string;
    value: {
      from: { id: string; name?: string; profile_picture_url?: string };
      item: string;
      text?: string;
      link?: string;
      mention?: string;
      media?: { id: string; url?: string };
      timestamp?: string;
    };
  }>;
}

interface WebhookPayload {
  object: string;
  entry?: InstagramMessagingEntry[];
}

export async function handleInstagramWebhook(
  payload: WebhookPayload,
  workspaceId: string,
): Promise<void> {
  console.log(`[Webhook] Processing Instagram webhook for workspace ${workspaceId}`);

  if (payload.object !== "instagram") {
    console.log(`[Webhook] Ignoring non-instagram object: ${payload.object}`);
    return;
  }

  const entry = payload.entry?.[0];
  if (!entry) return;

  // Determine IG account's instagramId
  const igAccount = await prisma.socialAccount.findFirst({
    where: { workspaceId, platform: "INSTAGRAM", instagramId: { not: null } },
    select: { instagramId: true, id: true },
  });
  const ourIgId = igAccount?.instagramId;

  // ── Handle changes field (Instagram Live comments / story replies / mentions) ──
  if (entry.changes && entry.changes.length > 0) {
    for (const change of entry.changes) {
      if (change.field !== "comments" && change.field !== "story_mentions" && change.field !== "mentions") {
        continue;
      }

      const eventId = `changes_${change.field}_${change.value.timestamp ?? Date.now()}`;
      const existing = await prisma.channelWebhookEvent.findUnique({ where: { event_id: eventId } });
      if (existing) {
        console.log(`[Webhook] Skipping duplicate event ${eventId}`);
        continue;
      }

      await prisma.channelWebhookEvent.create({
        data: {
          workspaceId,
          platform: "INSTAGRAM",
          event_type: change.field,
          event_id: eventId,
          raw_payload: change as unknown as Prisma.InputJsonValue,
          status: "PROCESSED",
          processed_at: new Date(),
        },
      });

      // Process comment / mention as inbound message
      const fromId = change.value.from?.id;
      const text = change.value.text ?? change.value.mention ?? "";
      const timestamp = change.value.timestamp;

      if (!fromId) continue;

      // Create contact if not exists
      const contact = await prisma.contact.upsert({
        where: { instagramId: fromId },
        update: {
          displayName: change.value.from?.name ?? undefined,
          profileImageUrl: change.value.from?.profile_picture_url ?? undefined,
        },
        create: {
          workspaceId,
          instagramId: fromId,
          displayName: change.value.from?.name ?? undefined,
          profileImageUrl: change.value.from?.profile_picture_url ?? undefined,
        },
      });

      const conversation = await upsertConversationFromWebhook(
        workspaceId,
        `ig_comment_${fromId}_${timestamp ?? Date.now()}`,
        "INSTAGRAM" as ChannelType,
        {
          instagramId: fromId,
          displayName: change.value.from?.name ?? undefined,
          profileImageUrl: change.value.from?.profile_picture_url ?? undefined,
        },
      );

      const message = await prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          contactId: contact.id,
          direction: "INBOUND",
          content: text || "(media/link attachment)",
          raw_payload: change as unknown as Prisma.InputJsonValue,
          message_id: eventId,
          status: "PENDING",
        },
      });

      // Create lead if none exists
      let lead = await prisma.lead.findFirst({
        where: { contactId: contact.id, workspaceId },
      });

      if (!lead) {
        const pipelineStages = await getOrCreatePipeline(workspaceId);
        const defaultStage = pipelineStages.find((s) => s.is_default) ?? pipelineStages[0];
        lead = await createLead(workspaceId, {
          contactId: contact.id,
          conversationId: conversation.id,
          source: `${change.field}_comment`,
          first_name: contact.displayName ?? undefined,
          pipelineStageId: defaultStage?.id,
        });
        await logActivity(workspaceId, lead.id, "lead_created", "Lead created from Instagram comment/mention", undefined, conversation.id);
      }

      // Update conversation lead
      if (lead && !conversation.leadId) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { leadId: lead.id },
        });
      }

      // Update unread
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unread_count: { increment: 1 },
          last_message_at: timestamp ? new Date(parseInt(timestamp) * 1000) : new Date(),
          last_message_preview: (text || "(media)").slice(0, 120),
        },
      });

      // Run orchestrator
      await leadOrchestrator.processInboundMessage(conversation.id, message.id);
    }
  }

  // ── Handle direct messages ──
  if (entry.messaging && entry.messaging.length > 0) {
    for (const event of entry.messaging) {
      const { message } = event;
      if (!message?.mid) continue;

      // Idempotency
      const existing = await prisma.channelWebhookEvent.findUnique({
        where: { event_id: message.mid },
      });
      if (existing) {
        console.log(`[Webhook] Skipping duplicate message event ${message.mid}`);
        continue;
      }

      await prisma.channelWebhookEvent.create({
        data: {
          workspaceId,
          platform: "INSTAGRAM",
          event_type: "message",
          event_id: message.mid,
          raw_payload: event as unknown as Prisma.InputJsonValue,
          status: "PROCESSING",
        },
      });

      const senderId = event.sender.id;

      // Get sender profile info from IG API (if needed)
      // For now, use what's available in the event
      const contactData = {
        instagramId: senderId,
        username: undefined as string | undefined,
        displayName: undefined as string | undefined,
        profileImageUrl: undefined as string | undefined,
      };

      const content = message.text ?? "";
      const mediaAttachments = message.attachments ?? [];

      const conversation = await upsertConversationFromWebhook(
        workspaceId,
        event.sender.id,
        "INSTAGRAM" as ChannelType,
        contactData,
      );

      const inboundMessage = await prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          contactId: conversation.contactId,
          direction: "INBOUND",
          content: content || "(media/attachment)",
          raw_payload: event as unknown as Prisma.InputJsonValue,
          message_id: message.mid,
          instagram_media_id: mediaAttachments[0]?.payload?.url ?? undefined,
          status: "PENDING",
        },
      });

      // Ensure lead exists
      let lead = await prisma.lead.findFirst({
        where: { contactId: conversation.contactId, workspaceId },
      });

      if (!lead) {
        const pipelineStages = await getOrCreatePipeline(workspaceId);
        const defaultStage = pipelineStages.find((s) => s.is_default) ?? pipelineStages[0];
        lead = await createLead(workspaceId, {
          contactId: conversation.contactId,
          conversationId: conversation.id,
          source: "instagram_dm",
          first_name: contactData.displayName ?? undefined,
          pipelineStageId: defaultStage?.id,
        });
        await logActivity(workspaceId, lead.id, "lead_created", "Lead created from first Instagram DM", undefined, conversation.id);
      }

      // Update conversation with lead and unread
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          leadId: lead.id ?? undefined,
          unread_count: { increment: 1 },
          last_message_at: new Date(),
          last_message_preview: (content || "(media)").slice(0, 120),
        },
      });

      // Mark webhook event processed
      await prisma.channelWebhookEvent.update({
        where: { event_id: message.mid },
        data: { status: "PROCESSED", processed_at: new Date() },
      });

      // Run orchestrator
      await leadOrchestrator.processInboundMessage(conversation.id, inboundMessage.id);
    }
  }
}
