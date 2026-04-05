import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getLeadWithDetails, updateLead } from "@/lib/domain/leads/service";

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
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  try {
    const lead = await getLeadWithDetails(id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (lead.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ lead });
  } catch (err) {
    console.error(`[GET /api/leads/${id}]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
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
    const body = await req.json() as Record<string, unknown>;

    const lead = await updateLead(id, body as Parameters<typeof updateLead>[1]);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (lead.workspaceId !== payload.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ lead });
  } catch (err) {
    console.error(`[PATCH /api/leads/${id}]`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
