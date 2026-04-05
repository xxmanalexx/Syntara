import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { handleInstagramWebhook } from "@/lib/integrations/instagram/dm-webhook-handler";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.replace("sha256=", "")));
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN ?? process.env.NEXTAUTH_SECRET ?? "syntara-verify-token";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Webhook] Meta webhook verified");
    return new NextResponse(challenge ?? "ok", { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET ?? "";

  if (!verifySignature(body, signature, appSecret)) {
    console.warn("[Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fan-out: find all workspaces with connected IG accounts
  // Match by Instagram account ID from the payload entry
  const igAccounts = await prisma.socialAccount.findMany({
    where: { platform: "INSTAGRAM", instagramId: { not: null } },
    select: { workspaceId: true, instagramId: true },
  });

  if (igAccounts.length === 0) {
    console.log("[Webhook] No IG accounts registered, ignoring");
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Spawn async handlers — don't wait for completion
  for (const account of igAccounts) {
    handleInstagramWebhook(payload as Parameters<typeof handleInstagramWebhook>[0], account.workspaceId)
      .catch((err) => console.error(`[Webhook] Handler error for workspace ${account.workspaceId}:`, err));
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}
