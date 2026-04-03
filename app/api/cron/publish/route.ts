import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET ?? "dev-cron-secret";

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { SchedulingService } = await import("@/lib/services/scheduling-service");
  const { PublishWorker } = await import("@/lib/workers/publish-worker");

  const schedulingService = new SchedulingService();
  const worker = new PublishWorker();

  const duePosts = await schedulingService.getDuePosts();
  if (duePosts.length === 0) {
    return NextResponse.json({ processed: 0, succeeded: 0, failed: 0 });
  }

  const result = await worker.run();
  return NextResponse.json(result);
}
