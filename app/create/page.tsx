"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ContentType, TonePreset } from "@/types";
import { Sparkles, Image, Link2, FileText, ShoppingBag, Megaphone } from "lucide-react";

const CONTENT_TYPES = [
  { value: "FEED_POST", label: "Feed Post", icon: Image, desc: "Single image or video post" },
  { value: "CAROUSEL", label: "Carousel", icon: Image, desc: "Multi-image swipeable post" },
  { value: "REEL", label: "Reel", icon: Sparkles, desc: "Short-form video with cover" },
  { value: "STORY", label: "Story", icon: Sparkles, desc: "Temporary frame-by-frame story" },
];

const SOURCE_TYPES = [
  { value: "topic", label: "Topic", icon: FileText },
  { value: "note", label: "Note", icon: FileText },
  { value: "product_update", label: "Product Update", icon: ShoppingBag },
  { value: "launch_update", label: "Launch Update", icon: Megaphone },
  { value: "promo_offer", label: "Promo / Offer", icon: Megaphone },
  { value: "url", label: "URL", icon: Link2 },
];

const TONE_OPTIONS = [
  { value: "CASUAL", label: "Casual" },
  { value: "BOLD", label: "Bold" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "PLAYFUL", label: "Playful" },
  { value: "EMPOWERING", label: "Empowering" },
  { value: "PREMIUM", label: "Premium" },
  { value: "SAFE", label: "Safe / Conservative" },
  { value: "MINIMAL", label: "Minimal" },
];

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    brandId: "",
    contentType: "FEED_POST" as ContentType,
    sourceType: "topic",
    sourceContent: "",
    url: "",
    tone: "CASUAL" as TonePreset,
    generateVisuals: true,
  });

  // Load brands on mount
  useEffect(() => {
    const token = localStorage.getItem("syntara_token");
    if (!token) return;
    fetch("/api/brands", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const brandList = d.brands ?? [];
        setBrands(brandList);
        // Auto-select first brand if only one exists
        if (brandList.length === 1) {
          setForm((f) => ({ ...f, brandId: brandList[0].id }));
        }
      })
      .catch(console.error);
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("syntara_token")}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      router.push(`/drafts/${data.draft.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Content</h1>
        <p className="text-gray-500 mt-1">Tell us what you want to post — our AI handles the rest.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition",
              s <= step ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-500"
            )}>
              {s}
            </div>
            <span className={cn("text-sm hidden sm:block", s <= step ? "text-gray-900 font-medium" : "text-gray-400")}>
              {s === 1 ? "Input" : s === 2 ? "Generate" : "Edit"}
            </span>
            {s < 3 && <div className={cn("w-8 h-px", s < step ? "bg-violet-400" : "bg-gray-200")} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>
      )}

      {/* Form — only show when not loading */}
      {!loading && step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {/* Brand */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Brand *</label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
            >
              <option value="">Select a brand...</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Content Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CONTENT_TYPES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setForm({ ...form, contentType: value as ContentType })}
                  className={cn(
                    "p-3 rounded-xl border-2 text-left transition",
                    form.contentType === value
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                  title={desc}
                >
                  <Icon className={cn("w-5 h-5 mb-1", form.contentType === value ? "text-violet-600" : "text-gray-400")} />
                  <p className={cn("text-xs font-medium", form.contentType === value ? "text-violet-700" : "text-gray-600")}>{label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">What do you want to post about?</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SOURCE_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm({ ...form, sourceType: value })}
                  className={cn(
                    "p-2.5 rounded-xl border-2 text-center transition flex flex-col items-center gap-1",
                    form.sourceType === value
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <Icon className={cn("w-4 h-4", form.sourceType === value ? "text-violet-600" : "text-gray-400")} />
                  <p className={cn("text-xs", form.sourceType === value ? "text-violet-700 font-medium" : "text-gray-500")}>{label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {form.sourceType === "url" ? "URL to analyze" : "Your content idea"}
            </label>
            {form.sourceType === "url" ? (
              <input
                type="url"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            ) : (
              <textarea
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                placeholder={
                  form.sourceType === "topic" ? "e.g. Our new vitamin C serum launch" :
                  form.sourceType === "promo_offer" ? "e.g. 20% off all serums this weekend only" :
                  "Describe what you want to post about..."
                }
                value={form.sourceContent}
                onChange={(e) => setForm({ ...form, sourceContent: e.target.value })}
              />
            )}
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setForm({ ...form, tone: value as TonePreset })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition",
                    form.tone === value
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Visuals Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Generate visuals with AI</p>
              <p className="text-xs text-gray-500">Create matching images using Nano Banana</p>
            </div>
            <button
              onClick={() => setForm({ ...form, generateVisuals: !form.generateVisuals })}
              className={cn(
                "w-12 h-6 rounded-full transition relative",
                form.generateVisuals ? "bg-violet-600" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition",
                form.generateVisuals ? "left-6" : "left-0.5"
              )} />
            </button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!form.brandId || (!form.sourceContent && !form.url) || loading}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate Content →"}
          </button>
        </div>
      )}

      {/* Generating State */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-violet-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Generating your content...</h2>
          <p className="text-gray-500 mb-6">Our AI is crafting unique captions, hooks, CTAs, and visual prompts tailored for your brand.</p>
          <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
            <span className="flex items-center gap-1">✍️ Writing captions</span>
            <span className="flex items-center gap-1">🏷️ Generating hashtags</span>
            <span className="flex items-center gap-1">🎨 Creating visual prompts</span>
          </div>
        </div>
      )}
    </div>
  );
}
