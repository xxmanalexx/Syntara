import { NextResponse } from "next/server";
import { runCommentPolling } from "@/lib/services/comment-polling-service";

export async function POST(req: Request) {
  // Simple auth: check cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
