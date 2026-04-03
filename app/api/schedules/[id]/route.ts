import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let workspaceId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    workspaceId = payload.workspaceId as string;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const postId = params.id;

  // Verify the scheduled post belongs to this workspace
  const post = await prisma.scheduledPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
  if (post.workspaceId !== workspaceId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (post.publishStatus !== "SCHEDULED") {
    return NextResponse.json(
      { error: `Cannot cancel a post that is already ${post.publishStatus.toLowerCase()}.` },
      { status: 400 }
    );
  }

  await prisma.scheduledPost.delete({ where: { id: postId } });
  return NextResponse.json({ success: true });
}
