import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createLead, logActivity } from "@/lib/domain/leads/service";
import { getOrCreatePipeline } from "@/lib/domain/leads/pipeline-service";

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

// POST /api/inbox/conversations/:id/convert-to-lead
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: conversationId } = await params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (conversation.leadId) {
      return NextResponse.json({ error: "Already has a linked lead" }, { status: 400 });
    }

    const pipelineStages = await getOrCreatePipeline(payload.workspaceId);
    const defaultStage = pipelineStages.find((s) => s.is_default) ?? pipelineStages[0];

    const lead = await createLead(payload.workspaceId, {
      contactId: conversation.contactId,
      conversationId,
      source: "instagram_dm",
      first_name: conversation.contact.displayName ?? undefined,
      email: conversation.contact.email ?? undefined,
      phone: conversation.contact.phone ?? undefined,
      pipelineStageId: defaultStage?.id,
    });

    await logActivity(
      payload.workspaceId,
      lead.id,
      "lead_created",
      `Lead created from inbox conversation with ${conversation.contact.displayName ?? conversation.contact.username ?? "unknown"}`,
      undefined,
      conversationId,
    );

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/inbox/conversations/:id/convert-to-lead]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
