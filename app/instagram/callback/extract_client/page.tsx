"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExtractPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = window.location.hash;
    const search = window.location.search;

    console.log("[Extract] Full URL:", url.href);
    console.log("[Extract] Hash:", hash);
    console.log("[Extract] Search:", search);

    // ── Case 1: Error in query params ───────────────────────────────────────
    const queryError = url.searchParams.get("error");
    const queryErrorReason = url.searchParams.get("error_reason");
    if (queryError || queryErrorReason) {
      console.log("[Extract] OAuth error in query:", queryError ?? queryErrorReason);
      router.replace(`/onboarding?error=${encodeURIComponent(queryError ?? queryErrorReason ?? "oauth_error")}`);
      return;
    }

    // ── Case 2: Code in query params (normal code flow, though rare) ────────
    const queryCode = url.searchParams.get("code");
    if (queryCode) {
      console.log("[Extract] Auth code found in query params:", queryCode.slice(0, 20) + "...");
      router.replace(`/api/instagram/callback?code=${encodeURIComponent(queryCode)}&state=${encodeURIComponent(url.searchParams.get("state") ?? "")}`);
      return;
    }

    // ── Case 3: Parse fragment ──────────────────────────────────────────────
    if (hash) {
      const fragmentParams = new URLSearchParams(hash.replace(/^#/, ""));
      const code = fragmentParams.get("code");
      const accessToken = fragmentParams.get("access_token");
      const state = fragmentParams.get("state");
      const fragError = fragmentParams.get("error");
      const fragErrorReason = fragmentParams.get("error_reason");

      console.log("[Extract] Fragment keys:", [...fragmentParams.keys()].join(", "));
      console.log("[Extract] code:", code ? code.slice(0, 20) + "..." : "none");
      console.log("[Extract] access_token:", accessToken ? "(present)" : "none");

      if (fragError || fragErrorReason) {
        router.replace(`/onboarding?error=${encodeURIComponent(fragError ?? fragErrorReason ?? "oauth_error")}`);
        return;
      }

      if (code) {
        // Standard code flow — forward to server callback
        console.log("[Extract] Forwarding auth code to server callback");
        router.replace(`/api/instagram/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state ?? "")}`);
        return;
      }

      if (accessToken) {
        // Implicit flow — access token returned directly in fragment.
        // This happens when Client OAuth Login is enabled on the Meta app.
        // We can't use this directly for server-side token exchange (needs client_secret).
        // Instead, redirect to onboarding with clear instructions.
        console.log("[Extract] Implicit flow detected — access_token in fragment, not code");
        router.replace(
          `/onboarding?error=implicit_flow&detail=${encodeURIComponent(
            "Facebook returned an access token instead of an authorization code. " +
            "This happens because 'Client OAuth Login' is ENABLED in your Meta app. " +
            "Go to your Meta App Dashboard → App Settings → Advanced → Authentication settings → " +
            "turn OFF 'Client OAuth Login', then try again."
          )}`
        );
        return;
      }
    }

    // ── Fallback: no code, no token ──────────────────────────────────────────
    console.log("[Extract] No code or token found in URL");
    router.replace(
      `/onboarding?error=no_code&detail=${encodeURIComponent(
        "No authorization code received. Check that your redirect URIs in Meta app settings " +
        "include exactly: http://localhost:3000/instagram/callback/extract_client"
      )}`
    );
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-fuchsia-50">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Connecting to Instagram...</h2>
        <p className="text-sm text-gray-500">Please wait, you&apos;ll be redirected shortly.</p>
        <p className="text-xs text-gray-400 mt-3">If this takes more than 30 seconds, close this window and try again.</p>
      </div>
    </div>
  );
}
