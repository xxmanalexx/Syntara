"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, Check, X, ChevronRight, Loader2 } from "lucide-react";

interface BrandProfile {
  id: string;
  name: string;
  description: string | null;
  audienceDesc: string | null;
  voiceGuidance: string | null;
  styleKeywords: string[];
  bannedPhrases: string[];
  bannedClaims: string[];
  ctaPreferences: string | null;
  visualStyle: string | null;
  preferredLanguage: string;
  colorReferences: string[];
  referenceUrls: string[];
  negativePrompts: string[];
}

const DEFAULT_BRAND = (): Partial<BrandProfile> => ({
  name: "",
  description: "",
  audienceDesc: "",
  voiceGuidance: "",
  styleKeywords: [],
  bannedPhrases: [],
  bannedClaims: [],
  ctaPreferences: "",
  visualStyle: "",
  preferredLanguage: "en",
  colorReferences: [],
  referenceUrls: [],
  negativePrompts: [],
});

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<Partial<BrandProfile>>(DEFAULT_BRAND());

  // Tag input state for arrays
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const getToken = () => localStorage.getItem("syntara_token") ?? "";

  const loadBrands = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    try {
      const res = await fetch("/api/brands", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  function startCreate() {
    setForm(DEFAULT_BRAND());
    setTagInputs({});
    setIsCreating(true);
    setEditingId(null);
  }

  function startEdit(brand: BrandProfile) {
    setForm({ ...brand });
    setTagInputs({});
    setEditingId(brand.id);
    setIsCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setForm(DEFAULT_BRAND());
    setTagInputs({});
  }

  function setField(key: keyof BrandProfile, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTag(field: keyof BrandProfile) {
    const input = (tagInputs[field] ?? "").trim();
    if (!input) return;
    setForm((f) => ({
      ...f,
      [field]: [...(f[field] as string[] ?? []), input],
    }));
    setTagInputs((t) => ({ ...t, [field]: "" }));
  }

  function removeTag(field: keyof BrandProfile, tag: string) {
    setForm((f) => ({
      ...f,
      [field]: (f[field] as string[] ?? []).filter((t) => t !== tag),
    }));
  }

  async function handleSave() {
    if (!form.name?.trim()) { setError("Brand name is required"); return; }
    const token = getToken();
    setSaving(true);
    setError("");
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/brands/${editingId}` : "/api/brands";
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await loadBrands();
        cancelEdit();
      } else {
        const data = await res.json();
        // Zod returns { error: { fieldErrors: { field: [messages] } } }
        const err = data.error;
        if (err && typeof err === "object" && !Array.isArray(err)) {
          const fe = (err as Record<string, unknown>).fieldErrors;
          if (fe && typeof fe === "object") {
            const msgs = Object.values(fe as Record<string, unknown[]>).flat().join("; ");
            setError(msgs || "Validation error");
          } else {
            setError("Validation failed. Check your fields.");
          }
        } else {
          setError(typeof err === "string" ? err : "Save failed");
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this brand? This cannot be undone.")) return;
    const token = getToken();
    await fetch(`/api/brands/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadBrands();
  }

  function TagInput({
    field,
    label,
    placeholder,
  }: {
    field: keyof BrandProfile;
    label: string;
    placeholder: string;
  }) {
    const tags = (form[field] as string[]) ?? [];
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium border border-violet-100"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(field, tag)}
                className="hover:text-violet-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInputs[field] ?? ""}
            onChange={(e) => setTagInputs((t) => ({ ...t, [field]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(field))}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
          />
          <button
            type="button"
            onClick={() => addTag(field)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  // ── Brand Form ─────────────────────────────────────────────────────────────
  if (isCreating || editingId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={cancelEdit} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {editingId ? "Edit Brand" : "New Brand"}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Brand Name *</label>
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Aesthetic PDRN"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Brand Description</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="A clear, concise description of what your brand is and stands for..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm resize-none"
            />
          </div>

          {/* Voice */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Voice & Tone</label>
            <textarea
              value={form.voiceGuidance ?? ""}
              onChange={(e) => setField("voiceGuidance", e.target.value)}
              placeholder="How should the brand sound? e.g. Warm and approachable, expert without being cold, confident but humble..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm resize-none"
            />
          </div>

          {/* Audience */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target Audience</label>
            <textarea
              value={form.audienceDesc ?? ""}
              onChange={(e) => setField("audienceDesc", e.target.value)}
              placeholder="Who are you talking to? e.g. Women 25-40 who care about skin quality and visible results..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* CTA Preferences */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">CTA Preference</label>
              <input
                type="text"
                value={form.ctaPreferences ?? ""}
                onChange={(e) => setField("ctaPreferences", e.target.value)}
                placeholder="e.g. Link in bio, Swipe up"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
              />
            </div>
            {/* Visual Style */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Visual Style</label>
              <input
                type="text"
                value={form.visualStyle ?? ""}
                onChange={(e) => setField("visualStyle", e.target.value)}
                placeholder="e.g. Clean, minimal, clinical"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Preferred Language */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preferred Language</label>
            <select
              value={form.preferredLanguage ?? "en"}
              onChange={(e) => setField("preferredLanguage", e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white"
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
              <option value="es">Español (Spanish)</option>
              <option value="pt">Português (Portuguese)</option>
              <option value="zh">中文 (Chinese)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="tr">Türkçe (Turkish)</option>
            </select>
          </div>

          {/* Preferred Language */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preferred Language</label>
            <select
              value={form.preferredLanguage ?? "en"}
              onChange={(e) => setField("preferredLanguage", e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white"
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
              <option value="es">Español (Spanish)</option>
              <option value="pt">Português (Portuguese)</option>
              <option value="zh">中文 (Chinese)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="tr">Türkçe (Turkish)</option>
            </select>
          </div>

          {/* Preferred Language */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preferred Language</label>
            <select
              value={form.preferredLanguage ?? "en"}
              onChange={(e) => setField("preferredLanguage", e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white"
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
              <option value="es">Español (Spanish)</option>
              <option value="pt">Português (Portuguese)</option>
              <option value="zh">中文 (Chinese)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="tr">Türkçe (Turkish)</option>
            </select>
          </div>

          {/* Tag inputs */}
          <TagInput
            field="styleKeywords"
            label="Style Keywords"
            placeholder="e.g. premium, minimal, clinical"
          />
          <TagInput
            field="bannedPhrases"
            label="Banned Phrases"
            placeholder="Words/phrases to never use"
          />
          <TagInput
            field="bannedClaims"
            label="Banned Claims"
            placeholder="Claims the brand cannot make"
          />
          <TagInput
            field="colorReferences"
            label="Color References"
            placeholder="Brand colors or palettes"
          />
          <TagInput
            field="negativePrompts"
            label="Visual Negative Prompts"
            placeholder="Visual styles to avoid"
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Brand"}
            </button>
            <button
              onClick={cancelEdit}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Brand List ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your brand profiles — voice, style, audience, and what to avoid.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Brand
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading...
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-violet-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">No brands yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first brand profile to start generating on-brand content.</p>
          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
          >
            Create your first brand
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-violet-100 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{brand.name}</h3>
                  {brand.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{brand.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {brand.styleKeywords?.slice(0, 5).map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-xs border border-gray-100"
                      >
                        {kw}
                      </span>
                    ))}
                    {brand.voiceGuidance && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs border border-violet-100">
                        {brand.voiceGuidance.slice(0, 40)}...
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(brand)}
                    className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(brand.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
