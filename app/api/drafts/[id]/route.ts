import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateDraftSchema } from "@/lib/validation";
import { ContentScoringService } from "@/lib/services/scoring-service";

const scoringService = new ContentScoringService();

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const draft = await prisma.draft.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { createdAt: "asc" } },
      mediaAssets: { include: { asset: true }, orderBy: { sortOrder: "asc" } },
      insights: true,
      brand: true,
    },
  });

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json();
    const parsed = updateDraftSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const updated = await prisma.draft.update({
      where: { id },
      data: { ...parsed.data, storyFrames: parsed.data.storyFrames as any },
    });

    await scoringService.updateScores(id);

    return NextResponse.json({ draft: updated });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.draft.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
