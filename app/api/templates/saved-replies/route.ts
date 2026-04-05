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

  try {
    const replies = await prisma.savedReply.findMany({
      where: { workspaceId: payload.workspaceId, is_active: true },
      orderBy: { title: "asc" },
    });
    return NextResponse.json({ replies });
  } catch (err) {
    console.error("[GET /api/templates/saved-replies]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const body = await req.json() as {
      title: string;
      content: string;
      category?: string;
      shortcut?: string;
      response_zone?: "GREEN" | "YELLOW" | "RED";
    };

    if (!body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const reply = await prisma.savedReply.create({
      data: {
        workspaceId: payload.workspaceId,
        title: body.title.trim(),
        content: body.content.trim(),
        category: body.category ?? "general",
        shortcut: body.shortcut?.trim() ?? null,
        response_zone: body.response_zone ?? "GREEN",
      },
    });

    return NextResponse.json({ reply }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/templates/saved-replies]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
