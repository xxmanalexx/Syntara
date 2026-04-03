import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { ContentScoringService } from "@/lib/services/scoring-service";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);
const scoringService = new ContentScoringService();

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
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

    const { id: draftId } = params;
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    // Validate the URL points to a real image file (follow redirects)
    let isImage = false;
    try {
      const res = await fetch(imageUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      const contentType = res.headers.get("content-type") ?? "";
      // Must be a direct image, not an HTML page or redirect chain ending in a page
      isImage = contentType.startsWith("image/");
    } catch {
      // If we can't verify, allow it (might be behind a firewall or use auth)
    }
    if (!isImage) {
      return NextResponse.json(
        { error: "The URL does not appear to be a valid image file. Please use a direct image link (ending in .jpg, .png, .webp, .gif) that serves an image directly, not a webpage." },
        { status: 400 }
      );
    }

    // Verify draft belongs to this workspace
    const draft = await prisma.draft.findFirst({
      where: { id: draftId, workspaceId },
      select: { id: true, workspaceId: true },
    });
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    // Create media asset
    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId: draft.workspaceId,
        draftId,
        assetSource: "UPLOAD",
        mediaType: "IMAGE",
        url: imageUrl,
      },
    });

    // Link to draft (increment sort order)
    const existingCount = await prisma.draftMedia.count({ where: { draftId } });
    await prisma.draftMedia.create({
      data: {
        draftId,
        assetId: asset.id,
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
      },
    });

    // Recalculate scores now that media is attached
    await scoringService.updateScores(draftId);

    return NextResponse.json({ asset, success: true });
  } catch (err) {
    console.error("Attach image error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
