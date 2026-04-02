"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const STEPS = ["Brand", "Instagram", "Done"];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [errorDetail, setErrorDetail] = useState(searchParams.get("detail") ?? "");

  const [brand, setBrand] = useState({
    name: "",
    description: "",
    audienceDesc: "",
    voiceGuidance: "",
    styleKeywords: "",
    bannedPhrases: "",
  });

  async function createBrand() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("syntara_token")}` },
        body: JSON.stringify({
          name: brand.name,
          description: brand.description || undefined,
          audienceDesc: brand.audienceDesc || undefined,
          voiceGuidance: brand.voiceGuidance || undefined,
          styleKeywords: brand.styleKeywords.split(",").map((s) => s.trim()).filter(Boolean),
          bannedPhrases: brand.bannedPhrases.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create brand");
      }
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition",
              i <= step ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-500"
            )}>
              {i + 1}
            </div>
            <span className={cn("text-sm hidden sm:block", i <= step ? "text-violet-600 font-medium" : "text-gray-400")}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className={cn("w-8 h-px", i < step ? "bg-violet-400" : "bg-gray-200")} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Error:</strong> {decodeURIComponent(error)}
          {errorDetail && <p className="mt-1 text-red-500 text-xs break-all">{decodeURIComponent(errorDetail)}</p>}
        </div>
      )}

      {step === 0 && (
        <>
          <h1 className="text-2xl font-bold mb-2">Set up your brand</h1>
          <p className="text-gray-500 mb-6">Tell us about your brand so our AI can create content that sounds like you.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand name *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="e.g. Glow Botanicals"
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                placeholder="What does your brand do? What makes it special?"
                value={brand.description}
                onChange={(e) => setBrand({ ...brand, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
              <textarea
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                placeholder="Who follows you? What are they like?"
                value={brand.audienceDesc}
                onChange={(e) => setBrand({ ...brand, audienceDesc: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice &amp; tone</label>
              <textarea
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                placeholder="Friendly, professional, witty... Describe your brand voice."
                value={brand.voiceGuidance}
                onChange={(e) => setBrand({ ...brand, voiceGuidance: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Style keywords</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="minimal, warm, bold (comma-separated)"
                value={brand.styleKeywords}
                onChange={(e) => setBrand({ ...brand, styleKeywords: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banned phrases</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="Phrases your brand would never use (comma-separated)"
                value={brand.bannedPhrases}
                onChange={(e) => setBrand({ ...brand, bannedPhrases: e.target.value })}
              />
            </div>
            <button
              onClick={createBrand}
              disabled={loading || !brand.name}
              className="w-full py-3 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Continue"}
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold mb-2">Connect Instagram</h1>
          <p className="text-gray-500 mb-6">Connect your Instagram professional account to start publishing.</p>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-sm text-amber-700">
                <strong>Prerequisites:</strong> Your Instagram account must be a <em>Professional</em> account (Business or Creator) linked to a Facebook Page.
              </p>
            </div>
            <a
              href="/api/instagram/connect"
              className="block w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium text-center hover:opacity-90 transition"
            >
              Connect Instagram
            </a>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-lg bg-white border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition"
            >
              Skip for now
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">You&apos;re all set!</h1>
            <p className="text-gray-500 mb-8">Your workspace is ready. Start creating your first post.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-8 py-3 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
            >
              Go to dashboard
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center justify-center py-16 text-gray-400">
              Loading...
            </div>
          </div>
        }>
          <OnboardingContent />
        </Suspense>
      </div>
    </div>
  );
}
