import { prisma } from "@/lib/db";
import type {
  Conversation,
  Message,
  Contact,
  ChannelType,
  MessageDirection,
  MessageStatus,
  ConversationStatus,
} from "@prisma/client";

export type ConversationWithContact = Conversation & {
  contact: Contact;
  messages?: Message[];
  lead?: { id: string; status: string; first_name?: string | null; last_name?: string | null } | null;
  assignedTo?: { id: string; user: { name?: string | null; email: string } } | null;
};

export async function getConversations(
  workspaceId: string,
  filters?: {
    status?: ConversationStatus;
    assignedToId?: string;
    channel?: ChannelType;
  },
): Promise<ConversationWithContact[]> {
  const where: Record<string, unknown> = { workspaceId };
  if (filters?.status) where.status = filters.status;
  if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters?.channel) where.channel = filters.channel;

  return prisma.conversation.findMany({
    where,
    include: {
      contact: true,
      lead: { select: { id: true, status: true, first_name: true, last_name: true } },
      assignedTo: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { last_message_at: "desc" },
    take: 50,
  });
}

export async function getConversationWithMessages(
  conversationId: string,
): Promise<(Conversation & { messages: Message[]; contact: Contact }) | null> {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread_count: 0 },
  });
}

export async function assignConversation(
  conversationId: string,
  memberId: string,
): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedToId: memberId },
  });
}

export async function upsertConversationFromWebhook(
  workspaceId: string,
  platformConversationId: string,
  channel: ChannelType,
  contactData: {
    instagramId?: string;
    whatsappId?: string;
    username?: string;
    displayName?: string;
    profileImageUrl?: string;
  },
): Promise<Conversation> {
  // Upsert contact
  const contact = await prisma.contact.upsert({
    where: {
      instagramId: contactData.instagramId ?? "whatsapp:" + (contactData.whatsappId ?? platformConversationId),
    },
    update: {
      username: contactData.username ?? undefined,
      displayName: contactData.displayName ?? undefined,
      profileImageUrl: contactData.profileImageUrl ?? undefined,
    },
    create: {
      workspaceId,
      instagramId: contactData.instagramId,
      whatsappId: contactData.whatsappId,
      username: contactData.username,
      displayName: contactData.displayName,
      profileImageUrl: contactData.profileImageUrl,
    },
  });

  // Upsert conversation
  const conversation = await prisma.conversation.upsert({
    where: { platform_conversation_id: platformConversationId },
    update: {
      contactId: contact.id,
      last_message_at: new Date(),
    },
    create: {
      workspaceId,
      contactId: contact.id,
      channel,
      platform_conversation_id: platformConversationId,
      last_message_at: new Date(),
    },
  });

  return conversation;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  direction: MessageDirection,
  status: MessageStatus,
): Promise<Message> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, contactId: true, workspaceId: true },
  });
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  return prisma.message.create({
    data: {
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      contactId: conversation.contactId,
      direction,
      content,
      status,
    },
  });
}

export async function getOrCreateContact(
  workspaceId: string,
  platformUserId: string,
  username: string,
  profileImageUrl: string | null,
  instagramId?: string,
  whatsappId?: string
): Promise<{ id: string; instagramId: string | null; whatsappId: string | null }> {
  return prisma.contact.upsert({
    where: {
      instagramId: instagramId ?? `unknown:${platformUserId}`,
    },
    update: { username, profileImageUrl: profileImageUrl ?? undefined },
    create: {
      workspaceId,
      instagramId: instagramId ?? null,
      whatsappId: whatsappId ?? null,
      username,
      displayName: username,
      profileImageUrl,
    },
  });
}

export async function sendInstagramReply(
  conversationId: string,
  message: Message,
  accessToken: string,
): Promise<{ message_id: string }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contact: { select: { instagramId: true } } },
  });
  if (!conversation?.contact?.instagramId) {
    throw new Error("Contact has no instagramId for sending DM");
  }

  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`;
  const payload = {
    recipient: { id: conversation.contact.instagramId },
    message: { text: message.content ?? "" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram API error: ${res.status} ${err}`);
  }

  const data = await res.json() as { message_id?: string; error?: { message: string } };
  if (data.error) throw new Error(`Instagram API error: ${data.error.message}`);
  if (!data.message_id) throw new Error("No message_id in Instagram API response");

  return { message_id: data.message_id };
}
