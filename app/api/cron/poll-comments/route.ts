import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { runCommentPolling } from "@/lib/services/comment-polling-service";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const result = await runCommentPolling();
    return NextResponse.json({
      success: true,
      workspacesChecked: result.workspaces,
      newComments: result.newComments,
    });
  } catch (err: any) {
    console.error("[CommentPoll] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}
