import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production",
);

async function getUserFromToken(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; workspaceId?: string };
  } catch (_) {
    return null;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const body = await req.json() as {
      instagramId?: string;
      username?: string;
      displayName?: string;
      email?: string;
      phone?: string;
      profileImageUrl?: string;
    };

    const contact = await prisma.contact.create({
      data: {
        workspaceId: payload.workspaceId,
        instagramId: body.instagramId,
        username: body.username,
        displayName: body.displayName,
        email: body.email,
        phone: body.phone,
        profileImageUrl: body.profileImageUrl,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/contacts]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const payload = await getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";

    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId: payload.workspaceId,
        ...(q && {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ contacts });
  } catch (err) {
    console.error("[GET /api/contacts]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
