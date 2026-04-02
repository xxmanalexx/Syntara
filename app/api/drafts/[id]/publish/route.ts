import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { InstagramPublishingService } from "@/lib/integrations/instagram/publishing-service";
import { AnalyticsSyncService } from "@/lib/services/analytics-service";
import { uploadToCloudinary } from "@/lib/integrations/cloudinary-upload";
import { readFile } from "fs/promises";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

async function getUserFromToken(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const payload = await getUserFromToken(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.sub as string;
  const draftId = params.id;

  // Load the draft with its media assets
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: {
      mediaAssets: { include: { asset: true } },
      brand: true,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Get the user's connected Instagram account — find by userId directly
  const account = await prisma.socialAccount.findFirst({
    where: {
      userId,
      platform: "INSTAGRAM",
      instagramId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!account || !account.accessToken) {
    return NextResponse.json(
      { error: "No Instagram account connected. Please connect Instagram first." },
      { status: 400 }
    );
  }

  if (!account.isProfessional) {
    return NextResponse.json(
      { error: "Only Professional Instagram accounts can publish. Please switch to a Business or Creator account." },
      { status: 400 }
    );
  }

  // Build caption from draft
  const caption = draft.caption ?? "";
  const hashtags = draft.hashtags ?? [];
  const fullCaption = hashtags.length > 0 ? `${caption}\n\n${hashtags.join(" ")}` : caption;

  const imageUrl = draft.mediaAssets?.[0]?.asset?.url;

  if (!imageUrl) {
    return NextResponse.json(
      { error: "No image attached. Please add an image before publishing." },
      { status: 400 }
    );
  }

  // Resolve image URL: Instagram needs a public HTTP(S) URL.
  // If the image is a relative path (/media/...) uploaded locally,
  // we must re-upload it to Cloudinary to get a public CDN URL.
  let publicImageUrl = imageUrl;
  const isLocalUpload = imageUrl.startsWith("/media/") || imageUrl.includes("localhost");
  if (isLocalUpload) {
    try {
      // Read local file and send as binary blob to Cloudinary
      const filePath = imageUrl.startsWith("/")
        ? path.join(process.cwd(), "public", imageUrl.replace("/media/", "media/"))
        : imageUrl;
      const fileContent = await readFile(filePath);
      const filename = path.basename(filePath);
      const mimeType = MIME_MAP[path.extname(filePath).toLowerCase()] ?? "image/jpeg";
      const blob = new Blob([fileContent], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      publicImageUrl = await uploadToCloudinary({ type: "file", file });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Failed to upload local image to CDN. Make sure the file exists and Cloudinary is configured. Error: ${err?.message ?? "unknown"}`,
        },
        { status: 400 }
      );
    }
  }

  const publishService = new InstagramPublishingService(account.accessToken);

  try {

    // Pass IG user ID directly to skip the /me/accounts lookup which can fail
    const igUserId = account.instagramId!;
    const result = await publishService.publishFeedPost(
      { imageUrl: publicImageUrl, caption: fullCaption, altText: draft.altText ?? undefined },
      igUserId
    );

    // Record the publish attempt
    await prisma.publishAttempt.create({
      data: {
        scheduledPostId: null,
        socialAccountId: account.id,
        instagramId: result.id,
        permalink: result.permalink,
        status: "PUBLISHED",
        attemptedAt: new Date(),
      },
    });

    // Update draft status
    await prisma.draft.update({
      where: { id: draftId },
      data: { status: "PUBLISHED" },
    });

    // Sync analytics for this account so dashboard metrics update
    try {
      const syncService = new AnalyticsSyncService(account.accessToken, igUserId);
      await syncService.syncRecentMedia(account.workspaceId, account.id, 10);
    } catch (syncErr) {
      // Non-fatal: analytics sync should not block publish success
      console.error("Analytics sync failed (non-fatal):", syncErr);
    }

    return NextResponse.json({
      success: true,
      postId: result.id,
      permalink: result.permalink,
    });
  } catch (err: any) {
    console.error("Publish failed:", err?.message ?? err);

    await prisma.publishAttempt.create({
      data: {
        scheduledPostId: null,
        socialAccountId: account.id,
        status: "FAILED",
        errorMessage: err?.message ?? "Unknown error",
      },
    });

    return NextResponse.json(
      { error: err?.message ?? "Publish failed" },
      { status: 500 }
    );
  }
}
