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

export async function GET(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const workspaceId = payload.workspaceId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      newLeadsToday,
      openConversations,
      leadsThisMonth,
      wonThisMonth,
      lostThisMonth,
      followUpsDueToday,
      pipelineFunnel,
      recentLeads,
    ] = await Promise.all([
      // New leads today
      prisma.lead.count({
        where: { workspaceId, createdAt: { gte: todayStart } },
      }),

      // Open conversations
      prisma.conversation.count({
        where: { workspaceId, status: "OPEN" },
      }),

      // Leads created this month
      prisma.lead.count({
        where: { workspaceId, createdAt: { gte: monthStart } },
      }),

      // Won this month
      prisma.lead.count({
        where: { workspaceId, status: "WON", closedAt: { gte: monthStart } },
      }),

      // Lost this month
      prisma.lead.count({
        where: { workspaceId, status: "LOST", closedAt: { gte: monthStart } },
      }),

      // Follow-ups due today
      prisma.task.count({
        where: {
          workspaceId,
          completedAt: null,
          dueDate: { lte: new Date(todayStart.getTime() + 86400000) },
        },
      }),

      // Pipeline funnel (count per stage)
      prisma.pipelineStage.findMany({
        where: { workspaceId },
        orderBy: { position: "asc" },
        include: {
          _count: { select: { leads: { where: { status: { notIn: ["WON", "LOST"] } } } } },
        },
      }),

      // Recent leads
      prisma.lead.findMany({
        where: { workspaceId },
        include: {
          contact: { select: { displayName: true, username: true } },
          pipelineStage: { select: { name: true, color: true } },
          assignedTo: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Avg first response time (time between first message and first outbound message)
    const firstResponseData = await prisma.message.findMany({
      where: {
        workspaceId,
        direction: "OUTBOUND",
        status: { in: ["SENT", "DELIVERED", "READ"] },
      },
      select: { createdAt: true, conversationId: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    const responseTimes: number[] = [];
    for (const msg of firstResponseData) {
      const firstInbound = await prisma.message.findFirst({
        where: { conversationId: msg.conversationId, direction: "INBOUND" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      if (firstInbound) {
        const diffMs = msg.createdAt.getTime() - firstInbound.createdAt.getTime();
        if (diffMs > 0 && diffMs < 86400000) { // under 24h
          responseTimes.push(diffMs);
        }
      }
    }
    const avgFirstResponseHours =
      responseTimes.length > 0
        ? +(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 3600000).toFixed(1)
        : null;

    return NextResponse.json({
      stats: {
        newLeadsToday,
        openConversations,
        leadsThisMonth,
        wonThisMonth,
        lostThisMonth,
        followUpsDueToday,
        avgFirstResponseHours,
      },
      pipelineFunnel: pipelineFunnel.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        position: stage.position,
        count: stage._count.leads,
      })),
      recentLeads: recentLeads.map((lead) => ({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        status: lead.status,
        source: lead.source,
        estimated_value: lead.estimated_value,
        currency: lead.currency,
        createdAt: lead.createdAt.toISOString(),
        contact: lead.contact,
        pipelineStage: lead.pipelineStage,
        assignedTo: lead.assignedTo,
      })),
    });
  } catch (err) {
    console.error("[GET /api/leads/analytics]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
