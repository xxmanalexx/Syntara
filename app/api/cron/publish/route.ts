import { NextResponse } from "next/server";
import { PublishWorker } from "@/lib/workers/publish-worker";

// Cron-secured route for scheduled publishing
export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const worker = new PublishWorker();
  const result = await worker.run();
  return NextResponse.json(result);
}
