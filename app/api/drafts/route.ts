import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const drafts = await prisma.draft.findMany({
    where: { workspaceId },
    include: {
      brand: true,
      mediaAssets: { include: { asset: true }, take: 1 },
      scheduledPost: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ drafts });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const draft = await prisma.draft.create({ data: body });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
