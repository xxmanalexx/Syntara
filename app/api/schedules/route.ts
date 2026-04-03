import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { schedulePostSchema } from "@/lib/validation";
import { SchedulingService } from "@/lib/services/scheduling-service";

const schedulingService = new SchedulingService();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schedulePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { draftId, variantId, scheduledAt } = parsed.data;
    const scheduled = await schedulingService.schedule(draftId, new Date(scheduledAt), variantId);
    return NextResponse.json({ scheduled }, { status: 201 });
  } catch (err: any) {
    console.error("Schedule error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const posts = workspaceId === "all"
    ? await prisma.scheduledPost.findMany({
        include: { draft: { include: { brand: true } } },
        orderBy: { scheduledAt: "asc" },
      })
    : await schedulingService.getByWorkspace(workspaceId);
  return NextResponse.json({ posts });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const draftId = url.searchParams.get("draftId");
  if (!draftId) return NextResponse.json({ error: "draftId required" }, { status: 400 });

  await schedulingService.unschedule(draftId);
  return NextResponse.json({ success: true });
}
