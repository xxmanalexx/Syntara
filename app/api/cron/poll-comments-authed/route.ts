import { NextResponse } from "next/server";
import { runCommentPolling } from "@/lib/services/comment-polling-service";

const CRON_SECRET = process.env.CRON_SECRET ?? "dev-cron-secret";

export async function POST(req: Request) {
  const token = req.headers.get("x-cron-secret");
  if (token !== CRON_SECRET) {
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
