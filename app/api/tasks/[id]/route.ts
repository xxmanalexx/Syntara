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

export async function PATCH(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop()!;

  try {
    const body = await req.json() as {
      completed?: boolean;
      title?: string;
      description?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueDate?: string | null;
    };

    const task = await prisma.task.findUnique({
      where: { id, workspaceId: payload.workspaceId },
    });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (body.completed !== undefined) {
      update.completedAt = body.completed ? new Date() : null;
    }
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined) update.description = body.description;
    if (body.priority !== undefined) update.priority = body.priority;
    if (body.dueDate !== undefined) update.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const updated = await prisma.task.update({ where: { id }, data: update });
    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error("[PATCH /api/tasks/[id]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop()!;

  try {
    await prisma.task.delete({ where: { id, workspaceId: payload.workspaceId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/tasks/[id]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
