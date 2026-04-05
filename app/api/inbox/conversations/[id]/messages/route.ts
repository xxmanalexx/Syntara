import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { sendMessage, sendInstagramReply } from "@/lib/domain/inbox/service";
import { decryptToken } from "@/lib/crypto";

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
    const body = await req.json() as { content: string };
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    // Verify conversation belongs to workspace
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true, channel: true, contact: { select: { instagramId: true } } },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (conversation.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create outbound message
    const message = await sendMessage(conversationId, body.content.trim(), "OUTBOUND", "SENT");

    // Send via Instagram API if IG channel
    if (conversation.channel === "INSTAGRAM") {
      const socialAccount = await prisma.socialAccount.findFirst({
        where: { workspaceId: payload.workspaceId, channel: "INSTAGRAM" },
        select: { accessToken: true },
      });

      if (socialAccount?.accessToken) {
        try {
          const decryptedToken = decryptToken(socialAccount.accessToken);
          const result = await sendInstagramReply(conversationId, message, decryptedToken);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: "SENT", message_id: result.message_id },
          });
        } catch (err: any) {
          console.error("[POST /api/inbox/conversations/[id]/messages] IG send error:", err?.message ?? err);
          const isPermissionError = err?.message?.includes("does not have the capability") || err?.message?.includes("permission");
          await prisma.message.update({
            where: { id: message.id },
            data: { status: isPermissionError ? "PENDING" : "FAILED" },
          });
        }
      }
    }

    // Update conversation last_message_at
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date(), last_message_preview: body.content.slice(0, 120) },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error(`[POST /api/inbox/conversations/${conversationId}/messages]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
