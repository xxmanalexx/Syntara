import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { execSync } from "child_process";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
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
    // Check if already running using pm2 jlist
    const raw = execSync("pm2 jlist 2>&1", { timeout: 5000 }).toString();
    const pm2List = JSON.parse(raw);
    const existing = pm2List.find((p: any) => p.name === "syntara-cron");
    if (existing?.pm2_env?.status === "online") {
      return NextResponse.json({ running: true, pid: existing.pid, message: "Already running" });
    }

    // Start it
    execSync("cd /home/bot/Syntara && NODE_ENV=production pm2 start scripts/cron-worker.js --name syntara-cron -o /tmp/syntara-cron.log -e /tmp/syntara-cron.err --time 2>&1", { timeout: 10000 });
    execSync("pm2 save 2>/dev/null", { timeout: 5000 });

    const raw2 = execSync("pm2 jlist 2>&1", { timeout: 5000 }).toString();
    const pm2List2 = JSON.parse(raw2);
    const proc = pm2List2.find((p: any) => p.name === "syntara-cron");

    return NextResponse.json({ running: true, pid: proc?.pid ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to launch cron worker" }, { status: 500 });
  }
}
