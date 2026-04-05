import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { getConversations, markConversationRead, assignConversation } from "@/lib/domain/inbox/service";
import type { ConversationStatus, ChannelType } from "@prisma/client";

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

export async function GET(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ConversationStatus | null;
  const assignedToId = searchParams.get("assignedToId") ?? undefined;
  const channel = searchParams.get("channel") as ChannelType | null;

  // Use JWT workspaceId or fall back
  const workspaceId = payload.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const conversations = await getConversations(workspaceId, {
      status: status ?? undefined,
      assignedToId: assignedToId ?? undefined,
      channel: channel ?? undefined,
    });
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[GET /api/inbox/conversations]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = payload.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const body = await req.json() as {
      action: "markRead" | "assign";
      conversationId: string;
      memberId?: string;
    };

    if (body.action === "markRead") {
      await markConversationRead(body.conversationId);
      return NextResponse.json({ success: true });
    }

    if (body.action === "assign") {
      if (!body.memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });
      await assignConversation(body.conversationId, body.memberId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/inbox/conversations]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
