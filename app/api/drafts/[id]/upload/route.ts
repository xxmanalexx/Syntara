import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);

const UPLOAD_DIR = path.join(process.cwd(), "public", "media");

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

    // Verify draft belongs to this workspace
    const draft = await prisma.draft.findFirst({
      where: { id: draftId, workspaceId },
      select: { id: true, workspaceId: true },
    });
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${nanoid()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write file
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(arrayBuffer));

    // Generate public URL
    const publicUrl = `/media/${filename}`;

    // Create media asset
    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId: draft.workspaceId,
        draftId,
        assetSource: "UPLOAD",
        mediaType: "IMAGE",
        url: publicUrl,
        mimeType: file.type,
      },
    });

    // Link to draft
    const existingCount = await prisma.draftMedia.count({ where: { draftId } });
    await prisma.draftMedia.create({
      data: {
        draftId,
        assetId: asset.id,
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
      },
    });

    return NextResponse.json({ asset, success: true, url: publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
