import { NextResponse } from "next/server";
import { InstagramAuthService } from "@/lib/integrations/instagram/auth-service";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");

  console.log("[Callback] code:", code ? `${code.slice(0, 20)}...` : "none");
  console.log("[Callback] state:", state, "error:", error);

  if (error || errorReason) {
    return NextResponse.redirect(
      new URL(`/onboarding?error=${encodeURIComponent(error ?? errorReason ?? "unknown")}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/onboarding?error=no_code`, req.url)
    );
  }

  const authService = new InstagramAuthService({
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    redirectUri: process.env.META_REDIRECT_URI ?? "",
    clientToken: process.env.META_CLIENT_TOKEN,
  });

  try {
    let accessToken: string;
    let expiresIn = 3600;
    let refreshToken: string | undefined;

    // Check if the "code" is actually an access token (implicit flow fallback)
    // Access tokens from implicit flow start with "EAA" or "AQDL" etc.
    const looksLikeToken =
      code.startsWith("EAA") || code.startsWith("AQDL") || code.startsWith("IGQV");

    if (looksLikeToken) {
      // Implicit flow — use the token directly (though it will be short-lived)
      console.log("[Callback] Treating code as implicit-flow access token");
      accessToken = code;
      expiresIn = 3600; // short-lived tokens expire in ~1 hour
    } else {
      // Standard code flow — exchange code for long-lived token
      console.log("[Callback] Exchanging auth code for token");
      const tokenRes = await authService.exchangeToken(code);
      accessToken = tokenRes.access_token;
      expiresIn = tokenRes.expires_in;
      refreshToken = tokenRes.refresh_token;
    }

    // Get Instagram business account
    let igUser;
    try {
      igUser = await authService.getInstagramAccount(accessToken);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("No Facebook pages") || msg.includes("No Instagram business account")) {
        return NextResponse.redirect(new URL("/onboarding?error=no_facebook_page", req.url));
      }
      throw err;
    }

    if (!igUser) {
      return NextResponse.redirect(new URL("/onboarding?error=no_instagram_account", req.url));
    }

    const isProfessional = igUser.account_type === "BUSINESS" || igUser.account_type === "CREATOR";
    const accountStatus = isProfessional ? "ACTIVE" : "PENDING_REVIEW";
    const workspaceId = state ?? "default";

    await prisma.socialAccount.upsert({
      where: { instagramId: igUser.id },
      create: {
        userId: "system",
        workspaceId,
        instagramId: igUser.id,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        accountStatus: accountStatus as any,
        isProfessional,
        username: igUser.username,
        displayName: igUser.name,
        profileImageUrl: igUser.profile_picture_url,
      },
      update: {
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        accountStatus: accountStatus as any,
        isProfessional,
        username: igUser.username,
        displayName: igUser.name,
        profileImageUrl: igUser.profile_picture_url,
      },
    });

    return NextResponse.redirect(new URL("/dashboard?connected=true", req.url));
  } catch (err: any) {
    console.error("[Callback] Error:", err?.message ?? err);
    const msg = err?.message ?? "";
    let redirectError = "auth_failed";
    if (msg.includes("No Facebook pages")) redirectError = "no_facebook_page";
    else if (msg.includes("No Instagram business account")) redirectError = "no_instagram_account";
    else if (msg.includes("Token exchange failed")) redirectError = "token_exchange_failed";
    return NextResponse.redirect(
      new URL(`/onboarding?error=${redirectError}&detail=${encodeURIComponent(msg.slice(0, 120))}`, req.url)
    );
  }
}
