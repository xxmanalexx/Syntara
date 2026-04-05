import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getLeads, createLead } from "@/lib/domain/leads/service";
import { getOrCreatePipeline } from "@/lib/domain/leads/pipeline-service";
import type { LeadStatus } from "@prisma/client";

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
  const status = searchParams.get("status") as LeadStatus | null;
  const assignedToId = searchParams.get("assignedToId") ?? undefined;
  const pipelineStageId = searchParams.get("pipelineStageId") ?? undefined;

  try {
    const leads = await getLeads(payload.workspaceId, {
      status: status ?? undefined,
      assignedToId: assignedToId ?? undefined,
      pipelineStageId: pipelineStageId ?? undefined,
    });
    return NextResponse.json({ leads });
  } catch (err) {
    console.error("[GET /api/leads]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const body = await req.json() as {
      contactId?: string;
      conversationId?: string;
      source?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      company?: string;
      estimated_value?: number;
      currency?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      assignedToId?: string;
      status?: LeadStatus;
      pipelineStageId?: string;
    };

    if (!body.contactId) {
      return NextResponse.json({ error: "contactId required" }, { status: 400 });
    }

    const lead = await createLead(payload.workspaceId, {
      contactId: body.contactId,
      conversationId: body.conversationId,
      source: body.source,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      estimated_value: body.estimated_value,
      currency: body.currency,
      utm_source: body.utm_source,
      utm_medium: body.utm_medium,
      utm_campaign: body.utm_campaign,
      assignedToId: body.assignedToId,
      status: body.status,
      pipelineStageId: body.pipelineStageId,
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/leads]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
