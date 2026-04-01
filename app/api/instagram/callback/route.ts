import { NextResponse } from "next/server";
import { InstagramAuthService } from "@/lib/integrations/instagram/auth-service";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/onboarding?error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const authService = new InstagramAuthService({
      appId: process.env.META_APP_ID ?? "",
      appSecret: process.env.META_APP_SECRET ?? "",
      redirectUri: process.env.META_REDIRECT_URI ?? "",
      clientToken: process.env.META_CLIENT_TOKEN,
    });

    const tokenRes = await authService.exchangeToken(code);
    const igUser = await authService.getInstagramAccount(tokenRes.access_token);

    if (!igUser) {
      return NextResponse.redirect(new URL("/onboarding?error=no_instagram_account", req.url));
    }

    const isProfessional = igUser.account_type === "BUSINESS" || igUser.account_type === "CREATOR";
    const accountStatus = isProfessional ? "ACTIVE" : "PENDING_REVIEW";
    const workspaceId = state ?? "default";

    const existing = await prisma.socialAccount.findUnique({
      where: { instagramId: igUser.id },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { instagramId: igUser.id },
        data: {
          accessToken: tokenRes.access_token,
          refreshToken: tokenRes.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenRes.expires_in * 1000),
          accountStatus: accountStatus as any,
          isProfessional,
          username: igUser.username,
          displayName: igUser.name,
          profileImageUrl: igUser.profile_picture_url,
        },
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: "system",
          workspaceId,
          instagramId: igUser.id,
          accessToken: tokenRes.access_token,
          refreshToken: tokenRes.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenRes.expires_in * 1000),
          accountStatus: accountStatus as any,
          isProfessional,
          username: igUser.username,
          displayName: igUser.name,
          profileImageUrl: igUser.profile_picture_url,
        },
      });
    }

    return NextResponse.redirect(new URL("/dashboard?connected=true", req.url));
  } catch (err) {
    console.error("Instagram OAuth callback error:", err);
    return NextResponse.redirect(new URL("/onboarding?error=auth_failed", req.url));
  }
}
