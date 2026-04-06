import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { AnalyticsSyncService } from "@/lib/services/analytics-service";

const JWT_SECRET = new TextEncoder().encode(
  process.env["NEXTAUTH_SECRET"] ?? "dev-secret-change-in-production"
);

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let userId: string;
  let workspaceId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    userId = payload.sub as string;
    workspaceId = payload.workspaceId as string;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Find the workspace's connected Instagram account — workspace-scoped
  const account = await prisma.socialAccount.findFirst({
    where: {
      workspaceId,
      platform: "INSTAGRAM",
      instagramId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!account || !account.accessToken) {
    return NextResponse.json(
      { error: "No Instagram account connected" },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(account.accessToken);
  } catch {
    return NextResponse.json(
      { error: "Instagram token is invalid. Please reconnect your account." },
      { status: 400 }
    );
  }

  const syncService = new AnalyticsSyncService(
    accessToken,
    account.instagramId!
  );

  try {
    // Sync recent media (limit 25 — fetches latest posts from IG API)
    const snapshots = await syncService.syncRecentMedia(
      account.workspaceId,
      account.id,
      25
    );

    return NextResponse.json({
      success: true,
      synced: snapshots.length,
      message:
        snapshots.length === 0
          ? "Already up to date"
          : `Synced ${snapshots.length} new post(s)`,
    });
  } catch (err: any) {
    console.error("Analytics sync error:", err?.message ?? err);
    return NextResponse.json(
      { error: `Sync failed: ${err?.message ?? "Unknown error"}` },
      { status: 500 }
    );
  }
}
