"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Sparkles, RefreshCw, Send, Calendar, Copy, Check,
  AlertTriangle, CheckCircle2, Info, Image, ChevronDown, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock draft data — replace with real fetch
const MOCK_DRAFT = {
  id: "1",
  contentType: "FEED_POST",
  brandName: "Glow Botanicals",
  tone: "CASUAL",
  status: "DRAFT",
  readinessScore: 78,
  brandScore: 85,
  completenessScore: 75,
  caption: "We just dropped our new Vitamin C Brightening Serum and we're SO excited to share it with you! ✨\n\nThis little bottle is packed with 15% pure L-Ascorbic Acid, hyaluronic acid, and ferulic acid to brighten, protect, and transform your skin.\n\nNo parabens. No sulfates. Just pure, effective skincare.\n\nSwipe to see the glow-up effect 🌿\n\n#Skincare #VitaminC #CleanBeauty #GlowBotanicals #NewProduct",
  cta: "Tap the link in bio to shop now!",
  hashtags: ["#Skincare", "#VitaminC", "#CleanBeauty", "#GlowBotanicals", "#NewProduct"],
  altText: "A flat-lay of Glow Botanicals Vitamin C serum next to fresh citrus fruits with soft morning light.",
  captionVariants: [
    "NEW DROP! Our Vitamin C serum is finally here and it's everything your skin has been waiting for. 💛 15% L-Ascorbic Acid + Hyaluronic Acid for maximum brightening without irritation.",
    "Brightening season is HERE 🌟 Our new Vitamin C serum launches TODAY — 15% pure Vitamin C, ferulic acid, and hyaluronic acid. All the glow, none of the nonsense. Link in bio to shop first!",
    "INTRODUCING: our most requested product ever! Vitamin C Brightening Serum with 15% L-Ascorbic Acid, ferulic acid, and hyaluronic acid. The trifecta of glowing skin. 💛 Shop link in bio!",
  ],
  visualPrompts: [
    "Soft morning light flat-lay: Glass dropper bottle of bright yellow vitamin C serum surrounded by sliced citrus fruits, green leaves, and dried flowers. Clean white marble background. Editorial beauty photography, high-end skincare aesthetic.",
    "Close-up macro shot of dewy skin with a drop of golden serum falling. Warm amber tones, soft bokeh background. Luxury skincare photography, magazine editorial style.",
    "Minimalist skincare flat-lay: Vitamin C serum bottle centered on natural linen with fresh orange slices and eucalyptus leaves. Nordic minimal aesthetic, soft natural lighting, top-down composition.",
  ],
  insights: [
    { severity: "info", message: "Post looks ready to publish! Scores: readiness 78, brand 85, completeness 75" },
    { severity: "warning", message: "No media attached yet. Posts with images get significantly more engagement." },
    { severity: "info", message: "Hashtag count is good (5). Keep it between 5-15 for best results." },
  ],
  mediaAssets: [],
};

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [caption, setCaption] = useState(MOCK_DRAFT.caption);
  const [cta, setCta] = useState(MOCK_DRAFT.cta);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [showVariants, setShowVariants] = useState(false);
  const [activeTab, setActiveTab] = useState<"caption" | "visuals" | "preview" | "insights">("caption");
  const [regenerating, setRegenerating] = useState(false);

  const draft = MOCK_DRAFT;

  function copyCaption() {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function applyVariant(i: number) {
    setSelectedVariant(i);
    setCaption(draft.captionVariants[i]);
    setShowVariants(false);
  }

  async function regenerateSection() {
    setRegenerating(true);
    // TODO: call /api/drafts/[id]/regenerate
    await new Promise((r) => setTimeout(r, 2000));
    setRegenerating(false);
  }

  const scoreColor = (s: number) => s >= 80 ? "text-green-600" : s >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/drafts")} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{draft.brandName}</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {draft.contentType.replace("_", " ")}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                draft.status === "READY" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
              )}>
                {draft.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Last edited just now</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={copyCaption} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy caption"}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium">
            <Calendar className="w-4 h-4" />
            Schedule
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition text-sm">
            <Send className="w-4 h-4" />
            Publish
          </button>
        </div>
      </div>

      {/* Score pills */}
      <div className="flex items-center gap-3 mb-6">
        {[
          { label: "Readiness", score: draft.readinessScore },
          { label: "Brand", score: draft.brandScore },
          { label: "Completeness", score: draft.completenessScore },
        ].map(({ label, score }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200">
            <span className="text-xs text-gray-500">{label}</span>
            <span className={cn("text-sm font-bold", scoreColor(score))}>{score}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">~220 chars</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            {(["caption", "visuals", "preview", "insights"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition capitalize",
                  activeTab === tab ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Caption Tab */}
          {activeTab === "caption" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-gray-700">AI-generated caption</span>
                </div>
                <div className="relative">
                  <button onClick={() => setShowVariants(!showVariants)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium">
                    {showVariants ? "Hide" : "Show"} variants ({draft.captionVariants.length})
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {showVariants && (
                    <div className="absolute right-0 top-8 z-10 w-80 bg-white rounded-xl border border-gray-200 shadow-lg p-3 space-y-2">
                      {draft.captionVariants.map((v, i) => (
                        <button key={i} onClick={() => applyVariant(i)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg text-sm transition",
                            selectedVariant === i ? "bg-violet-50 border border-violet-200" : "hover:bg-gray-50"
                          )}>
                          <p className="font-medium text-gray-700 mb-1">Variant {String.fromCharCode(65 + i)}</p>
                          <p className="text-gray-500 line-clamp-2">{v}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <textarea
                rows={8}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none text-sm text-gray-700 leading-relaxed"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />

              {/* CTA */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CTA</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hashtags</label>
                <div className="flex flex-wrap gap-1.5">
                  {draft.hashtags.map((tag) => (
                    <span key={tag} className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Regenerate section */}
              <div className="flex items-center gap-3 pt-2">
                <button onClick={regenerateSection} disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 transition text-sm font-medium disabled:opacity-50">
                  <RefreshCw className={cn("w-4 h-4", regenerating && "animate-spin")} />
                  Regenerate
                </button>
                <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:ring-2 focus:ring-violet-500 outline-none">
                  <option>Make shorter</option>
                  <option>Make longer</option>
                  <option>Make safer</option>
                  <option>Make bolder</option>
                  <option>Premium tone</option>
                </select>
              </div>
            </div>
          )}

          {/* Visuals Tab */}
          {activeTab === "visuals" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Visual concept prompts</h3>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition">
                  <Image className="w-4 h-4" />
                  Generate images
                </button>
              </div>
              <div className="space-y-3">
                {draft.visualPrompts.map((prompt, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Concept {i + 1}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{prompt}</p>
                    <div className="flex gap-2 mt-3">
                      <button className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:border-violet-300 transition">
                        Edit prompt
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-600 text-xs font-medium hover:bg-violet-100 transition">
                        Generate image
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Upload your own image to edit or generate variations →</p>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === "preview" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Instagram Preview</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-3 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">glowbotanicals</p>
                    <p className="text-xs text-gray-500">Sponsored</p>
                  </div>
                </div>
                <div className="aspect-square bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <span className="text-amber-400 text-4xl">🖼</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-gray-800">❤️</span>
                    <span className="text-gray-800">💬</span>
                    <span className="text-gray-800">✈️</span>
                    <span className="ml-auto text-gray-800">📖</span>
                  </div>
                  <p className="text-sm text-gray-900 font-semibold mb-1">glowbotanicals</p>
                  <p className="text-sm text-gray-700 line-clamp-4">{caption}</p>
                  <p className="text-xs text-gray-400 mt-2">View all 24 comments</p>
                </div>
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === "insights" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Intelligence</h3>
              {draft.insights.map((insight, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  insight.severity === "info" ? "bg-blue-50 border-blue-100" :
                  insight.severity === "warning" ? "bg-amber-50 border-amber-100" :
                  "bg-red-50 border-red-100"
                )}>
                  {insight.severity === "info" && <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                  {insight.severity === "warning" && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                  {insight.severity === "critical" && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                  <p className="text-sm text-gray-700">{insight.message}</p>
                </div>
              ))}
              {!draft.mediaAssets?.length && (
                <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-gray-200 text-center">
                  <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Drop an image or click to upload</p>
                  <button className="mt-2 text-sm text-violet-600 font-medium hover:text-violet-700">Upload media</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Activity / Meta */}
        <div className="space-y-4">
          {/* Variants selector */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Variants</h3>
            <div className="space-y-2">
              {draft.captionVariants.map((v, i) => (
                <button key={i} onClick={() => applyVariant(i)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition",
                    selectedVariant === i ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-gray-200"
                  )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-500">Variant {String.fromCharCode(65 + i)}</span>
                    {selectedVariant === i && <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{v}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity</h3>
            <div className="space-y-3">
              {[
                { action: "Caption regenerated", time: "10m ago", icon: RefreshCw },
                { action: "Variant B selected", time: "12m ago", icon: Check },
                { action: "Generated 3 variants", time: "15m ago", icon: Sparkles },
                { action: "Draft created from topic", time: "20m ago", icon: FileText },
              ].map(({ action, time, icon: Icon }) => (
                <div key={action} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700">{action}</p>
                    <p className="text-xs text-gray-400">{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fix import for FileText
import { FileText } from "lucide-react";
