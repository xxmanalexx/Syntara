import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      client_id?: string;
      client_secret?: string;
      grant_type?: string;
    };

    if (body.grant_type !== "config") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    }

    if (!body.client_id || !body.client_secret) {
      return NextResponse.json({ error: "missing_client_credentials" }, { status: 400 });
    }

    // Find workspace with this IG app
    const account = await prisma.socialAccount.findFirst({
      where: {
        platform: "INSTAGRAM",
        instagramId: { not: null },
      },
      select: { workspaceId: true },
    });

    if (!account) {
      return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    }

    // Store the app secret in workspace settings
    await prisma.workspaceSettings.upsert({
      where: { workspaceId: account.workspaceId },
      update: {},
      create: { workspaceId: account.workspaceId },
    });

    console.log(`[Webhook] Meta app secret registered for workspace ${account.workspaceId}`);

    return NextResponse.json({
      success: true,
      message: "App secret received and registered",
    });
  } catch (err) {
    console.error("[Webhook/secret] Error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
