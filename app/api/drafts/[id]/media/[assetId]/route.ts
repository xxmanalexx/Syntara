import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; assetId: string } }
) {
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

    const { id: draftId, assetId } = params;

    // Verify draft belongs to this workspace
    const draft = await prisma.draft.findFirst({
      where: { id: draftId, workspaceId },
      select: { id: true },
    });
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    // Verify asset belongs to this workspace
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, workspaceId },
    });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    // Unlink from draft
    await prisma.draftMedia.deleteMany({ where: { draftId, assetId } });

    // Delete the asset record
    await prisma.mediaAsset.delete({ where: { id: assetId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove media error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
