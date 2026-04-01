import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { brandProfileSchema } from "@/lib/validation";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export async function GET(req: Request) {
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

    const brands = await prisma.brandProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ brands });
  } catch (err) {
    console.error("Brand list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
    const parsed = brandProfileSchema.safeParse({ ...body, workspaceId });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const brand = await prisma.brandProfile.create({ data: parsed.data });
    return NextResponse.json({ brand }, { status: 201 });
  } catch (err) {
    console.error("Brand create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
