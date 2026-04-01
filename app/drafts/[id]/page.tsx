"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Sparkles, RefreshCw, Send, Calendar, Copy, Check,
  AlertTriangle, Info, Image, ChevronDown, Clock, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DraftVariant {
  id: string;
  name: string | null;
  isSelected: boolean;
  data: Record<string, unknown>;
}

interface DraftBrand {
  id: string;
  name: string;
}

interface DraftInsight {
  severity: "info" | "warning" | "critical";
  message: string;
}

interface Draft {
  id: string;
  contentType: string;
  status: string;
  tone: string;
  caption: string;
  cta: string | null;
  hashtags: string[];
  altText: string | null;
  readinessScore: number;
  brandScore: number;
  completenessScore: number;
  variants: DraftVariant[];
  brand: DraftBrand;
  insights: DraftInsight[];
  mediaAssets: Array<{ asset: { id: string; url: string | null } }>;
  createdAt: string;
  updatedAt: string;
}

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor state (caption tab)
  const [caption, setCaption] = useState("");
  const [cta, setCta] = useState("");
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [showVariants, setShowVariants] = useState(false);
  const [activeTab, setActiveTab] = useState<"caption" | "visuals" | "preview" | "insights">("caption");

  // Hashtags as editable tags
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);

  const getToken = () => localStorage.getItem("syntara_token") ?? "";

  const loadDraft = useCallback(async () => {
    if (!draftId) return;
    const token = getToken();
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to load draft");
      }
      const data = await res.json();
      const d: Draft = data.draft;
      setDraft(d);
      setCaption(d.caption ?? "");
      setCta(d.cta ?? "");
      setHashtags(d.hashtags ?? []);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => { loadDraft(); }, [loadDraft]);

  async function saveDraft(patch: Record<string, unknown>) {
    if (!draft) return;
    const token = getToken();
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) console.error("Save failed:", await res.json());
      else await loadDraft();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCaption() {
    await saveDraft({ caption, cta, hashtags });
  }

  async function handleSaveHashtags() {
    await saveDraft({ hashtags });
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function applyVariant(idx: number) {
    const variant = draft?.variants[idx];
    if (!variant || !draft) return;
    setSelectedVariantIdx(idx);
    const data = variant.data as Record<string, unknown>;
    setCaption(typeof data.caption === "string" ? data.caption : caption);
    setCta(typeof data.cta === "string" ? data.cta : cta);
    setShowVariants(false);
  }

  function addHashtag(tag: string) {
    const clean = tag.trim().replace(/^#/, "");
    if (!clean || hashtags.includes(`#${clean}`)) return;
    const next = [...hashtags, `#${clean}`];
    setHashtags(next);
    saveDraft({ hashtags: next });
  }

  function removeHashtag(tag: string) {
    const next = hashtags.filter((t) => t !== tag);
    setHashtags(next);
    saveDraft({ hashtags: next });
  }

  const scoreColor = (s: number) =>
    s >= 80 ? "text-green-600" : s >= 50 ? "text-amber-600" : "text-red-500";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading draft...
      </div>
    );
  }

  if (fetchError || !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <AlertTriangle className="w-8 h-8 mb-3 text-red-400" />
        <p className="font-medium text-red-600 mb-2">{fetchError || "Draft not found"}</p>
        <Link href="/drafts" className="text-sm text-violet-600 hover:underline">← Back to drafts</Link>
      </div>
    );
  }

  const charCount = caption.length;
  const captionVariantData = (v: DraftVariant) => v.data as Record<string, unknown>;

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
              <h1 className="text-xl font-bold text-gray-900">{draft.brand?.name ?? "Brand"}</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {draft.contentType.replace("_", " ")}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                draft.status === "READY" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
              )}>
                {draft.status}
              </span>
              {saving && <span className="text-xs text-gray-400">Saving...</span>}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Last edited {new Date(draft.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCaption}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
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
            <span className={cn("text-sm font-bold", scoreColor(score))}>{score ?? "—"}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">~{charCount} chars</span>
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
                  <span className="text-sm font-semibold text-gray-700">Caption</span>
                </div>
                {draft.variants.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowVariants(!showVariants)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                    >
                      {showVariants ? "Hide" : "Show"} variants ({draft.variants.length})
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {showVariants && (
                      <div className="absolute right-0 top-8 z-10 w-80 bg-white rounded-xl border border-gray-200 shadow-lg p-3 space-y-2">
                        {draft.variants.map((v, i) => (
                          <button
                            key={v.id}
                            onClick={() => applyVariant(i)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg text-sm transition",
                              selectedVariantIdx === i
                                ? "bg-violet-50 border border-violet-200"
                                : "hover:bg-gray-50 border border-transparent"
                            )}
                          >
                            <p className="font-medium text-gray-700 mb-1">
                              {v.name ?? `Variant ${String.fromCharCode(65 + i)}`}
                            </p>
                            <p className="text-gray-500 line-clamp-2">
                              {(captionVariantData(v).caption as string) ?? ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <textarea
                rows={8}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none text-sm text-gray-700 leading-relaxed"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={handleSaveCaption}
                placeholder="Write or edit your caption..."
              />

              {/* CTA */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CTA</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  onBlur={handleSaveCaption}
                  placeholder="e.g. Link in bio to shop now!"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hashtags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium"
                    >
                      {tag}
                      <button onClick={() => removeHashtag(tag)} className="hover:text-blue-800 ml-0.5">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addHashtag(hashtagInput);
                        setHashtagInput("");
                      }
                    }}
                    placeholder="Type hashtag and press Enter"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                  />
                  <button
                    onClick={() => { addHashtag(hashtagInput); setHashtagInput(""); }}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Regenerate */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={async () => {
                    setSaving(true);
                    const token = getToken();
                    await fetch("/api/drafts/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        brandId: draft.brand?.id ?? "",
                        regenerateFromDraftId: draft.id,
                      }),
                    });
                    await loadDraft();
                    setSaving(false);
                  }}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 transition text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", saving && "animate-spin")} />
                  {saving ? "Regenerating..." : "Regenerate"}
                </button>
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
              {draft.variants[selectedVariantIdx]
                ? (() => {
                    const vp = captionVariantData(draft.variants[selectedVariantIdx]);
                    const visualPrompts = (vp.visualPrompts ?? vp.visualConceptPrompts ?? []) as string[];
                    if (!visualPrompts.length) {
                      return <p className="text-sm text-gray-400 py-4 text-center">No visual prompts generated yet.</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {visualPrompts.slice(0, 3).map((prompt, i) => (
                          <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500">Prompt {i + 1}</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { navigator.clipboard.writeText(prompt); }}
                                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                                >
                                  Copy prompt
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const url = window.prompt("Paste your generated image URL:", "");
                                    if (!url || !url.startsWith("http")) return;
                                    setSaving(true);
                                    const token = getToken();
                                    const res = await fetch(`/api/drafts/${draft.id}/media`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ imageUrl: url }),
                                    });
                                    if (res.ok) {
                                      await loadDraft();
                                    } else {
                                      alert("Failed to attach image");
                                    }
                                    setSaving(false);
                                  }}
                                  className="text-xs text-green-600 hover:text-green-700 font-medium"
                                >
                                  Insert image
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{prompt}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                : <p className="text-sm text-gray-400 py-4 text-center">No variants available.</p>}
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
                    <p className="text-sm font-semibold text-gray-900">{draft.brand?.name?.toLowerCase().replace(/\s+/g, "") ?? "brand"}</p>
                    <p className="text-xs text-gray-500">Sponsored</p>
                  </div>
                </div>
                {draft.mediaAssets && draft.mediaAssets.length > 0 ? (
                  <img
                    src={draft.mediaAssets[0].asset.url!}
                    alt="Post image"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <span className="text-gray-300 text-4xl">🖼</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-gray-800">❤️</span>
                    <span className="text-gray-800">💬</span>
                    <span className="text-gray-800">✈️</span>
                    <span className="ml-auto text-gray-800">📖</span>
                  </div>
                  <p className="text-sm text-gray-900 font-semibold mb-1">{draft.brand?.name ?? "brand"}</p>
                  <p className="text-sm text-gray-700 line-clamp-6">{caption}</p>
                  <p className="text-xs text-gray-400 mt-2">{hashtags.slice(0, 5).join(" ")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === "insights" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Intelligence</h3>
              {draft.insights.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No insights yet.</p>
              )}
              {draft.insights.map((insight, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    insight.severity === "info"
                      ? "bg-blue-50 border-blue-100"
                      : insight.severity === "warning"
                      ? "bg-amber-50 border-amber-100"
                      : "bg-red-50 border-red-100"
                  )}
                >
                  {insight.severity === "info" && <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                  {insight.severity === "warning" && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                  {insight.severity === "critical" && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                  <p className="text-sm text-gray-700">{insight.message}</p>
                </div>
              ))}
              {(!draft.mediaAssets || draft.mediaAssets.length === 0) && (
                <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-gray-200 text-center">
                  <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No media attached yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Variants + Activity */}
        <div className="space-y-4">
          {/* Variants */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Content Variants ({draft.variants.length})
            </h3>
            {draft.variants.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No variants generated.</p>
            )}
            <div className="space-y-2">
              {draft.variants.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => applyVariant(i)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition",
                    selectedVariantIdx === i
                      ? "border-violet-300 bg-violet-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-500">
                      {v.name ?? `Variant ${String.fromCharCode(65 + i)}`}
                    </span>
                    {selectedVariantIdx === i && (
                      <Check className="w-3.5 h-3.5 text-violet-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {(captionVariantData(v).caption as string) ?? ""}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Brand</span>
                <span className="font-medium text-gray-900">{draft.brand?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{draft.contentType.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tone</span>
                <span className="font-medium text-gray-900">{draft.tone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-900">{draft.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-600">{new Date(draft.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
