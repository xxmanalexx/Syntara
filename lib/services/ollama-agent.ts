import { z } from "zod";
import { ollamaClient } from "@/lib/integrations/ollama/client";
import { prisma } from "@/lib/db";
import {
  upsertConversationFromWebhook,
  sendMessage,
  sendInstagramReply,
} from "@/lib/domain/inbox/service";
import {
  createLead,
  logActivity,
} from "@/lib/domain/leads/service";
import { getOrCreatePipeline } from "@/lib/domain/leads/pipeline-service";
import { decryptToken } from "@/lib/crypto";
import type { ChannelType } from "@prisma/client";

const intentSchema = z.object({
  intent: z.string().optional(),
  extracted_fields: z.record(z.unknown()).optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  suggested_reply: z.string().optional(),
  reply: z.string().optional(), // some models use 'reply' instead
  response_zone: z.enum(["GREEN", "YELLOW", "RED"]).optional(),
  next_action: z.enum(["send_reply", "draft_for_approval", "create_task", "move_stage", "skip"]).optional(),
  suggested_stage: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  should_create_lead: z.boolean().optional(),
});

type IntentOutput = z.infer<typeof intentSchema>;

const STAGE_PROMPTS: Record<string, string> = {
  NEW_INQUIRY: `You are a sales assistant handling a NEW INQUIRY. The prospect just reached out. Your goal: qualify them quickly, show interest, and gather basic info (name, budget/timeline if not already known). Keep responses warm, concise, and professional. 2-3 sentences max.`,
  QUALIFYING: `You are a sales assistant in the QUALIFYING stage. Dig deeper into the prospect's needs, timeline, and budget. Ask one focused question at a time. Be helpful, not pushy. Keep replies to 2-3 sentences.`,
  OFFER_SENT: `You are a sales assistant after an OFFER HAS BEEN SENT. Follow up professionally, address any questions, and nudge toward a decision without being aggressive. Keep it brief.`,
  FOLLOW_UP_PENDING: `You are a sales assistant doing a FOLLOW UP. Re-engage the prospect warmly. Remind them of the value, answer any outstanding questions. Be friendly and persistent. 2 sentences.`,
  READY_TO_BUY: `You are a sales assistant for a prospect READY TO BUY. Help them complete the purchase smoothly. Confirm details, express enthusiasm. Be concise and action-oriented.`,
  WON: `You are a customer success assistant. Thank the customer warmly and ensure they have everything they need.`,
  LOST: `You are a professional assistant. Handle this gracefully — acknowledge the outcome respectfully and keep the door open for future business.`,
};

function buildSystemPrompt(
  businessFacts: string | null,
  leadStatus: string | null,
  leadStage: string | null,
  contactName: string | null,
  conversationHistory: string,
  savedReplies: string,
): string {
  const stagePrompt = leadStatus ? (STAGE_PROMPTS[leadStatus] ?? STAGE_PROMPTS.NEW_INQUIRY) : STAGE_PROMPTS.NEW_INQUIRY;

  const businessSection = businessFacts
    ? `\n\nBUSINESS CONTEXT (use these facts only, never invent information):\n${businessFacts}`
    : "";

  const contactSection = contactName ? `\n\nCONTACT: ${contactName}` : "";

  return `${stagePrompt}${businessSection}${contactSection}

CONVERSATION HISTORY (most recent last):
${conversationHistory}

AVAILABLE SAVED REPLIES:
${savedReplies || "(none)"}`;
}

export class LeadOrchestrator {
  async processInboundMessage(conversationId: string, messageId: string): Promise<void> {
    // 1. Load context
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { contact: true, lead: true } } },
    });
    if (!message) throw new Error(`Message ${messageId} not found`);

    const { conversation } = message;
    const { contact, lead } = conversation;

    const workspaceId = conversation.workspaceId;

    // Get workspace settings for business facts
    const settings = await prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    });

    // Get last 5 messages for history
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const historyText = recentMessages
      .reverse()
      .map((m) => `[${m.direction}] ${m.content ?? "(media)"}`)
      .join("\n");

    // Get saved replies
    const savedReplies = await prisma.savedReply.findMany({
      where: { workspaceId, is_active: true },
      orderBy: { title: "asc" },
      take: 20,
    });
    const savedRepliesText = savedReplies
      .map((r) => `[${r.shortcut ? r.shortcut + " — " : ""}${r.title}]: ${r.content}`)
      .join("\n");

    const systemPrompt = buildSystemPrompt(
      settings?.businessFacts ?? null,
      lead?.status ?? null,
      lead?.pipelineStageId ?? null,
      contact.displayName ?? contact.username ?? null,
      historyText,
      savedRepliesText,
    );

    const userPrompt = `Incoming message from ${contact.displayName ?? contact.username ?? "unknown"}: "${message.content ?? "(media/attachment)"}"

Analyze this message and generate a suggested reply. Respond with valid JSON only, for example:
{"intent":"pricing_inquiry","reply":"Hi! Thanks for reaching out. Our pricing starts at...","confidence":0.85,"response_zone":"GREEN","next_action":"draft_for_approval"}`;

    // 2. Call Ollama
    let parsed: IntentOutput;
    try {
      parsed = await ollamaClient.generateJSON(
        {
          model: settings?.ollamaTextModelGrowthOs ?? settings?.ollamaTextModel ?? "minimax-m2.7:cloud",
          system: systemPrompt,
          prompt: userPrompt,
        },
        intentSchema,
        2,
      );
    } catch (err) {
      console.error("[LeadOrchestrator] Ollama error:", err);
      await prisma.message.update({
        where: { id: messageId },
        data: { ai_confidence: 0, response_zone: "RED" },
      });
      return;
    }

    // 3. Update message with AI data — use safe fallbacks for optional fields
    const suggestedReply = parsed.suggested_reply ?? parsed.reply ?? "";
    await prisma.message.update({
      where: { id: messageId },
      data: {
        ai_intent: parsed.intent ?? "general",
        ai_confidence: parsed.confidence ?? 0.5,
        ai_suggestion: suggestedReply,
        response_zone: parsed.response_zone ?? "YELLOW",
      },
    });

    // 4. Determine auto-reply behavior
    const responseZone = parsed.response_zone ?? "YELLOW";
    const shouldAutoReply = settings?.autoReplyEnabled === true;
    const isGreenZone = responseZone === "GREEN";
    const greenOnlyMode = settings?.autoReplyGreenOnly === true;

    const nextAction = parsed.next_action ?? (suggestedReply ? "draft_for_approval" : "skip");

    if (nextAction === "skip") {
      return;
    }

    if (parsed.should_create_lead && !lead) {
      // Create lead from conversation
      const pipelineStages = await getOrCreatePipeline(workspaceId);
      const defaultStage = pipelineStages.find((s) => s.is_default) ?? pipelineStages[0];

      const newLead = await createLead(workspaceId, {
        contactId: contact.id,
        conversationId,
        source: "instagram_dm",
        first_name: contact.displayName ?? undefined,
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        pipelineStageId: defaultStage?.id,
      });

      await logActivity(
        workspaceId,
        newLead.id,
        "lead_created",
        "Lead auto-created from first Instagram DM",
        undefined,
        conversationId,
      );
    }


    if (suggestedReply) {
      const status = (isGreenZone && (!greenOnlyMode || isGreenZone))
        ? "APPROVED"
        : "AI_DRAFT";

      const outboundMessage = await sendMessage(
        conversationId,
        suggestedReply,
        "OUTBOUND",
        status,
      );

      // Auto-send if GREEN zone, auto-reply on, AND it's a comment (has ig_media_id)
      // DMs require instagram_manage_messages permission — skip auto-send for DMs until approved
      const isComment = !!conversation.ig_media_id;
      if (isGreenZone && shouldAutoReply && isComment) {
        const socialAccount = await prisma.socialAccount.findFirst({
          where: { workspaceId, channel: conversation.channel as ChannelType },
          select: { accessToken: true, instagramId: true },
        });

        if (socialAccount?.accessToken) {
          try {
            const decryptedToken = decryptToken(socialAccount.accessToken);
            const result = await sendInstagramReply(
              conversationId,
              outboundMessage,
              decryptedToken,
              socialAccount.instagramId ?? undefined,
            );
            await prisma.message.update({
              where: { id: outboundMessage.id },
              data: { status: "SENT", message_id: result.message_id },
            });
          } catch (err) {
            console.error("[LeadOrchestrator] Failed to send IG reply:", err);
            await prisma.message.update({
              where: { id: outboundMessage.id },
              data: { status: "FAILED" },
            });
          }
        }
      }
    }

    // 5. Log activity
    if (lead) {
      const logIntent = parsed.intent ?? "general";
      const logConfidence = parsed.confidence ?? 0.5;
      const logZone = parsed.response_zone ?? "YELLOW";
      await logActivity(
        workspaceId,
        lead.id,
        "message_received",
        `Inbound message analyzed: ${logIntent} (confidence: ${(logConfidence * 100).toFixed(0)}%, zone: ${logZone})`,
        { intent: logIntent, confidence: logConfidence, response_zone: logZone, suggested_reply: suggestedReply },
        conversationId,
      );
    }
  }
}

export const leadOrchestrator = new LeadOrchestrator();
