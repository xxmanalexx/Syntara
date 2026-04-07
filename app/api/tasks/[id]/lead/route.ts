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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  try {
    const body = await req.json() as { leadId: string };
    if (!body.leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (task.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { leadId: body.leadId },
    });
    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error(`[PATCH /api/tasks/${id}/lead]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
