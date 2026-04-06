import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { sendInstagramReply } from "@/lib/domain/inbox/service";
import type { ChannelType } from "@prisma/client";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production",
);

async function getUserFromToken(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; workspaceId?: string };
  } catch (_) {
    return null;
  }
}

// GET /api/approvals — list AI_DRAFT messages pending approval
export async function GET(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const drafts = await prisma.message.findMany({
    where: {
      conversation: { workspaceId: payload.workspaceId },
      direction: "OUTBOUND",
      status: "AI_DRAFT",
    },
    include: {
      conversation: {
        select: {
          id: true,
          ig_media_id: true,
          ig_post_caption: true,
          ig_post_permalink: true,
          contact: { select: { id: true, displayName: true, username: true, profileImageUrl: true } },
          lead: { select: { id: true, first_name: true, last_name: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ drafts });
}

// POST /api/approvals — approve (send) or reject a draft
export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  let messageId: string;
  let action: string;

  try {
    const body = await req.json() as { messageId: string; action: "approve" | "reject" };
    messageId = body.messageId;
    action = body.action;
  } catch (_) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!messageId || !action) {
    return NextResponse.json({ error: "messageId and action required" }, { status: 400 });
  }

  const draft = await prisma.message.findFirst({
    where: { id: messageId, status: "AI_DRAFT" },
    include: { conversation: { include: { contact: true } } },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  if (draft.conversation.workspaceId !== payload.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let responseZone: "REJECTED" | "SENT" = "REJECTED";
  let messageIdResult: string | undefined;

  if (action === "reject") {
    await prisma.message.update({ where: { id: messageId }, data: { status: "REJECTED" } });
    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  // approve — send the message
  const socialAccount = await prisma.socialAccount.findFirst({
    where: { workspaceId: payload.workspaceId, channel: draft.conversation.channel as ChannelType },
    select: { accessToken: true, instagramId: true },
  });

  if (!socialAccount?.accessToken) {
    return NextResponse.json({ error: "No connected social account found" }, { status: 400 });
  }

  const decryptedToken = decryptToken(socialAccount.accessToken);
  const hasIgMedia = !!draft.conversation.ig_media_id;

  try {
    if (hasIgMedia) {
      const result = await sendInstagramReply(
        draft.conversation.id,
        draft,
        decryptedToken,
      );
      messageIdResult = result.message_id;
    } else {
      const igUserId = socialAccount.instagramId ?? "17841477661019142";
      const endpoint = `https://graph.facebook.com/v21.0/${igUserId}/messages`;
      const formData = new URLSearchParams();
      formData.set("recipient", JSON.stringify({ id: draft.conversation.contact.username ?? draft.conversation.contact.displayName }));
      formData.set("message", JSON.stringify({ text: draft.content ?? "" }));
      formData.set("access_token", decryptedToken);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const result = await res.json() as { message_id?: string; error?: { message: string } };
      if (result.error?.message) {
        throw new Error(result.error.message);
      }
      messageIdResult = result.message_id;
    }
    responseZone = "SENT";
  } catch (sendErr) {
    console.error("[POST /api/approvals] send error:", sendErr);
    await prisma.message.update({ where: { id: messageId }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Failed to send message. Check Instagram permissions." }, { status: 500 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { status: responseZone, message_id: messageIdResult ?? "sent" },
  });

  return NextResponse.json({ success: true, status: responseZone, message_id: messageIdResult });
}