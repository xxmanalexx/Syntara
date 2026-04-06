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

  try {
    const drafts = await prisma.message.findMany({
      where: {
        conversation: { workspaceId: payload.workspaceId },
        direction: "OUTBOUND",
        status: "AI_DRAFT",
      },
      include: {
        conversation: {
          include: {
            contact: { select: { id: true, displayName: true, username: true, profileImageUrl: true } },
            lead: { select: { id: true, first_name: true, last_name: true, status: true } },
            ig_post_caption: true,
            ig_post_permalink: true,
            ig_media_id: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ drafts });
  } catch (err) {
    console.error("[GET /api/approvals]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/approvals — approve (send) or reject a draft
export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const { messageId, action } = await req.json() as { messageId: string; action: "approve" | "reject" };

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

    if (action === "reject") {
      await prisma.message.update({ where: { id: messageId }, data: { status: "REJECTED" } });
      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    // approve — send the message
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { workspaceId: payload.workspaceId, channel: draft.conversation.channel as ChannelType },
      select: { accessToken: true, ig_user_id: true },
    });

    if (!socialAccount?.accessToken) {
      return NextResponse.json({ error: "No connected social account found" }, { status: 400 });
    }

    const decryptedToken = decryptToken(socialAccount.accessToken);

    // Use ig_media_id to route: comment reply vs DM
    const hasIgMedia = !!draft.conversation.ig_media_id;

    let result;
    try {
      if (hasIgMedia) {
        // Comment reply
        result = await sendInstagramReply(
          draft.conversation.id,
          draft,
          decryptedToken,
        );
      } else {
        // DM
        const igUserId = socialAccount.ig_user_id ?? "17841477661019142";
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
        result = await res.json() as { message_id?: string; error?: { message: string } };
        if (result.error?.message) {
          throw new Error(result.error.message);
        }
      }
    } catch (sendErr) {
      console.error("[POST /api/approvals] send error:", sendErr);
      await prisma.message.update({ where: { id: messageId }, data: { status: "FAILED" } });
      return NextResponse.json({ error: "Failed to send message. Check Instagram permissions." }, { status: 500 });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { status: "SENT", message_id: result.message_id ?? "sent" },
    });

    return NextResponse.json({ success: true, status: "SENT", message_id: result.message_id });
  } catch (err) {
    console.error("[POST /api/approvals]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}