import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { markLeadLost, logActivity } from "@/lib/domain/leads/service";

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
    const lead = await markLeadLost(id);
    if (lead.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await logActivity(payload.workspaceId, id, "stage_change", "Lead marked as LOST");

    return NextResponse.json({ lead });
  } catch (err) {
    console.error(`[POST /api/leads/${id}/lost]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
