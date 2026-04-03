/**
 * Syntara Background Cron Worker
 *
 * Standalone process that runs independently of the Next.js server.
 * Polls the database every 5 minutes for due scheduled posts and publishes them.
 *
 * Usage:
 *   node scripts/cron-worker.js
 *
 * For production, run via PM2:
 *   pm2 start scripts/cron-worker.js --name syntara-cron
 *   pm2 save
 */

const { PrismaClient } = require("@prisma/client");

const CRON_SECRET = process.env.CRON_SECRET ?? "dev-cron-secret";
const BASE_URL = process.env.CRON_WORKER_BASE_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const prisma = new PrismaClient();

async function runPublishCycle() {
  const now = new Date();

  // Find all SCHEDULED posts that are past their scheduled time
  const duePosts = await prisma.scheduledPost.findMany({
    where: {
      publishStatus: "SCHEDULED",
      scheduledAt: { lte: now },
    },
  });

  if (duePosts.length === 0) {
    console.log(`[${now.toISOString()}] No due posts.`);
    return;
  }

  console.log(`[${now.toISOString()}] Found ${duePosts.length} due post(s):`);
  for (const post of duePosts) {
    console.log(`  - ${post.id} (scheduled: ${post.scheduledAt.toISOString()})`);
  }

  // Call the publish endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/cron/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET,
      },
      body: JSON.stringify({ triggeredBy: "cron-worker" }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[${now.toISOString()}] Publish endpoint error ${res.status}: ${text}`);
      return;
    }

    const result = await res.json();
    console.log(
      `[${now.toISOString()}] Publish cycle result: processed=${result.processed}, succeeded=${result.succeeded}, failed=${result.failed}`
    );
  } catch (err) {
    console.error(`[${now.toISOString()}] Failed to reach publish endpoint: ${err.message}`);
  }
}

async function main() {
  console.log("===========================================");
  console.log("Syntara Background Cron Worker");
  console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("===========================================");

  // Run immediately on startup, then on schedule
  await runPublishCycle();

  setInterval(runPublishCycle, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal cron worker error:", err);
  process.exit(1);
});
