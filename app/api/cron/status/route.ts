import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const { execSync } = require("child_process");
    const list = execSync("pm2 list --json 2>/dev/null", { timeout: 5000 }).toString();
    const pm2List = JSON.parse(list);
    const cronProc = pm2List.find((p: any) => p.name === "syntara-cron");
    const running = !!(cronProc && cronProc.pm2_env?.status === "online");

    // Read recent logs
    let recentLogs: string[] = [];
    try {
      const logOut = execSync("pm2 logs syntara-cron --lines 10 --nostream 2>&1", { timeout: 5000 }).toString();
      recentLogs = logOut.split("\n").filter(Boolean).slice(-10).map((l: string) => l.replace(/^\[\s*\d+\]\s*/, ""));
    } catch {}

    return NextResponse.json({ running, recentLogs });
  } catch {
    return NextResponse.json({ running: false, recentLogs: [], error: "Could not reach PM2" });
  }
}
