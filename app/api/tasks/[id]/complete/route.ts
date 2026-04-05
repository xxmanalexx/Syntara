import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { completeTask } from "@/lib/domain/leads/service";

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

  const { id } = await params;

  try {
    const task = await completeTask(id);
    return NextResponse.json({ task });
  } catch (err) {
    console.error(`[POST /api/tasks/${id}/complete]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
