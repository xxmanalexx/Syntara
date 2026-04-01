import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);

export async function GET(
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

    const brand = await prisma.brandProfile.findFirst({
      where: { id: params.id, workspaceId },
    });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    return NextResponse.json({ brand });
  } catch (err) {
    console.error("Brand GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const existing = await prisma.brandProfile.findFirst({
      where: { id: params.id, workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const body = await req.json();

    // Build update object — only update fields that are explicitly provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    const allowedFields = [
      "name", "description", "audienceDesc", "voiceGuidance",
      "styleKeywords", "bannedPhrases", "bannedClaims",
      "ctaPreferences", "visualStyle", "colorReferences",
      "referenceUrls", "negativePrompts",
    ] as const;
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const brand = await prisma.brandProfile.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json({ brand });
  } catch (err) {
    console.error("Brand PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await prisma.brandProfile.findFirst({
      where: { id: params.id, workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    await prisma.brandProfile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Brand DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
