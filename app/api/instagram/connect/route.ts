import { NextResponse } from "next/server";
import { InstagramAuthService } from "@/lib/integrations/instagram/auth-service";

const authService = new InstagramAuthService({
  appId: process.env.META_APP_ID ?? "",
  appSecret: process.env.META_APP_SECRET ?? "",
  redirectUri: process.env.META_REDIRECT_URI ?? "",
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("workspaceId") ?? "default";
  const authUrl = authService.getAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
