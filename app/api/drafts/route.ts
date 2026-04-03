import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createDraftSchema } from "@/lib/validation";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let workspaceId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    workspaceId = payload.workspaceId as string;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

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

  const enriched = drafts.map((d) => ({
    ...d,
    hasImage: d.mediaAssets.length > 0 && !!d.mediaAssets[0].asset?.url,
    brandName: d.brand?.name,
  }));

  return NextResponse.json({ drafts: enriched });
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let workspaceId: string;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      workspaceId = payload.workspaceId as string;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createDraftSchema.safeParse({ ...body, workspaceId });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const draft = await prisma.draft.create({ data: parsed.data });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (err) {
    console.error("Draft create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
