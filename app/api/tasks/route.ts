import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createTask, getTasksForLead } from "@/lib/domain/leads/service";

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

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  const assignedToId = searchParams.get("assignedToId");
  const includeCompleted = searchParams.get("includeCompleted") !== "false";

  try {
    const where: Record<string, unknown> = { workspaceId: payload.workspaceId };
    if (leadId) where.leadId = leadId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (!includeCompleted) where.completedAt = null;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: { select: { id: true, first_name: true, last_name: true } },
        assignedTo: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("[GET /api/tasks]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const body = await req.json() as {
      leadId?: string;
      assignedToId?: string;
      title: string;
      description?: string;
      type?: "FOLLOW_UP" | "CALL" | "QUOTE" | "BOOKING" | "MEETING" | "OTHER";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueDate?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const task = await createTask(payload.workspaceId, {
      leadId: body.leadId,
      assignedToId: body.assignedToId,
      title: body.title,
      description: body.description,
      type: body.type,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/tasks]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
