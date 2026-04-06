import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { runCommentPolling } from "@/lib/services/comment-polling-service";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production",
);
const CRON_SECRET = process.env.CRON_SECRET ?? "dev-cron-secret";

// Supports both JWT auth (browser sync button) and x-cron-secret (server cron)
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret");

  if (!authHeader && !cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cron service auth
  if (cronSecret === CRON_SECRET) {
    try {
      const result = await runCommentPolling();
      return NextResponse.json({
        success: true,
        workspacesChecked: result.workspaces,
        newComments: result.newComments,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[CommentPoll] Error:", err);
      return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
    }
  }

  // JWT auth (from browser sync button)
  if (authHeader?.startsWith("Bearer ")) {
    try {
      await jwtVerify(authHeader.replace("Bearer ", ""), JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCommentPolling();
    return NextResponse.json({
      success: true,
      workspacesChecked: result.workspaces,
      newComments: result.newComments,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[CommentPoll] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}
