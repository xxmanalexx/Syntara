import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/settings/accounts/save-token
// Directly save an Instagram access token without OAuth.
// Provide token + workspaceId + username (get username from Meta developer portal).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, workspaceId, username, igUserId } = body as {
      token: string;
      workspaceId: string;
      username?: string;
      igUserId?: string;
    };

    if (!token || !workspaceId) {
      return NextResponse.json({ error: "token and workspaceId are required" }, { status: 400 });
    }

    // Use provided info or defaults
    const resolvedUsername = username ?? "instagram_user";
    const resolvedIgId = igUserId ?? `ig_${Date.now()}`;

    await prisma.socialAccount.upsert({
      where: { instagramId: resolvedIgId },
      create: {
        userId: null,
        workspaceId,
        instagramId: resolvedIgId,
        accessToken: token,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000 * 24 * 60),
        accountStatus: "ACTIVE",
        isProfessional: true,
        username: resolvedUsername,
      },
      update: {
        accessToken: token,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000 * 24 * 60),
        username: resolvedUsername,
      },
    });

    return NextResponse.json({ success: true, username: resolvedUsername });
  } catch (err: any) {
    console.error("[SaveToken] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
