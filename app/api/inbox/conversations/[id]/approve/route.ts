import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { sendInstagramReply } from "@/lib/domain/inbox/service";
import { decryptToken } from "@/lib/crypto";
import { logActivity } from "@/lib/domain/leads/service";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production",
);

async function getUserFromToken(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; workspaceId?: string };
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: conversationId } = await params;

  try {
    const body = await req.json() as { messageId: string };

    // Get the AI_DRAFT message
    const message = await prisma.message.findUnique({
      where: { id: body.messageId },
      include: { conversation: { select: { workspaceId: true, channel: true, leadId: true, id: true } } },
    });

    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (message.conversation.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.status !== "AI_DRAFT") {
      return NextResponse.json({ error: "Message is not an AI_DRAFT" }, { status: 400 });
    }

    // Update message status to APPROVED
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { status: "APPROVED" },
    });

    // Send via Instagram if INSTAGRAM channel
    if (message.conversation.channel === "INSTAGRAM" && message.content) {
      const socialAccount = await prisma.socialAccount.findFirst({
        where: { workspaceId: payload.workspaceId, channel: "INSTAGRAM" },
        select: { accessToken: true },
      });

      if (socialAccount?.accessToken) {
        try {
          const decryptedToken = decryptToken(socialAccount.accessToken);
          const result = await sendInstagramReply(conversationId, updated, decryptedToken);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: "SENT", message_id: result.message_id },
          });
        } catch (err) {
          console.error("[POST /approve] IG send error:", err);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: "FAILED" },
          });
          return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
        }
      }
    }

    // Update conversation last_message_at
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date(), last_message_preview: (message.content ?? "").slice(0, 120) },
    });

    // Log activity
    if (message.conversation.leadId) {
      await logActivity(
        payload.workspaceId,
        message.conversation.leadId,
        "message_sent",
        `AI draft approved and sent: "${(message.content ?? "").slice(0, 80)}"`,
        undefined,
        conversationId,
      );
    }

    return NextResponse.json({ success: true, message: updated });
  } catch (err) {
    console.error(`[POST /api/inbox/conversations/${conversationId}/approve]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
