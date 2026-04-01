import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { brandProfileSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  // For now, list all brands (add workspace filter later)
  const brands = await prisma.brandProfile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ brands });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = brandProfileSchema.safeParse(body);
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
