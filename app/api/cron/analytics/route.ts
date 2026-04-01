import { NextResponse } from "next/server";
import { AnalyticsWorker } from "@/lib/workers/analytics-worker";

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const worker = new AnalyticsWorker();
  const result = await worker.run();
  return NextResponse.json(result);
}
