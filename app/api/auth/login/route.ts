import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compare, hash } from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

async function makeToken(payload: { sub: string; workspaceId: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const workspace = await prisma.workspace.findFirst({ where: { userId: user.id } });
    if (!workspace) {
      const newWs = await prisma.workspace.create({
        data: { name: `${user.name ?? "My"} Workspace`, userId: user.id },
      });
      const token = await makeToken({ sub: user.id, workspaceId: newWs.id, email: user.email });
      return NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, workspaceId: newWs.id } });
    }

    const token = await makeToken({ sub: user.id, workspaceId: workspace.id, email: user.email });
    return NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, workspaceId: workspace.id } });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
