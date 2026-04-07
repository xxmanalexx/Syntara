import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: conversationId, messageId } = await params;

  try {
    // Verify conversation belongs to workspace
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, workspaceId: payload.workspaceId },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.message.delete({ where: { id: messageId, conversationId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[DELETE /api/inbox/conversations/${conversationId}/messages/${messageId}]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
