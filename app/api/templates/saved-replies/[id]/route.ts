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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const reply = await prisma.savedReply.findUnique({ where: { id } });
    if (!reply) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (reply.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ reply });
  } catch (err) {
    console.error(`[GET /api/templates/saved-replies/${id}]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.savedReply.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json() as {
      title?: string;
      content?: string;
      category?: string;
      shortcut?: string | null;
      response_zone?: "GREEN" | "YELLOW" | "RED";
      is_active?: boolean;
    };

    const updated = await prisma.savedReply.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.shortcut !== undefined && { shortcut: body.shortcut }),
        ...(body.response_zone !== undefined && { response_zone: body.response_zone }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      },
    });

    return NextResponse.json({ reply: updated });
  } catch (err) {
    console.error(`[PATCH /api/templates/saved-replies/${id}]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.savedReply.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.savedReply.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[DELETE /api/templates/saved-replies/${id}]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
