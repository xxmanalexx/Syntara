"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  User,
  Palette,
  Link2,
  Key,
  Bell,
  Check,
  Loader2,
  AlertCircle,
  Instagram,
  Plus,
  Trash2,
} from "lucide-react";

interface OllamaModels {
  models: string[];
}

interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  ollamaBaseUrl: string;
  ollamaTextModel: string;
  ollamaEmbeddingsModel: string;
  nanobananaBaseUrl: string;
  nanobananaApiKey: string | null;
  autoReplyEnabled: boolean;
  autoReplyGreenOnly: boolean;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<
    "account" | "brand" | "connections" | "ai" | "notifications"
  >("ai");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Settings state
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [textModel, setTextModel] = useState("llama3.2:latest");
  const [embeddingsModel, setEmbeddingsModel] = useState("nomic-embed-text:latest");
  const [nanoBananaUrl, setNanoBananaUrl] = useState("https://api.nanobanana.io/v1");
  const [nanoBananaKey, setNanoBananaKey] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyGreenOnly, setAutoReplyGreenOnly] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);

  const getToken = (): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("syntara_token") ?? "";
  };

  const requireAuth = () => {
    if (!getToken()) {
      window.location.href = "/login";
      return false;
    }
    return true;
  };

  const loadSettings = useCallback(async () => {
    if (!requireAuth()) return;

    setLoading(true);
    setError(null);

    const token = getToken();

    try {
      // Load saved settings
      console.log("[Settings] Token found, fetching settings...");
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[Settings] /api/settings status:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("[Settings] Settings response:", data);
        if (data.settings) {
          const s = data.settings as WorkspaceSettings;
          if (s.workspaceId) setWorkspaceId(s.workspaceId as string);
          setOllamaUrl(s.ollamaBaseUrl ?? "http://localhost:11434");
          setTextModel(s.ollamaTextModel);
          setEmbeddingsModel(s.ollamaEmbeddingsModel);
          setNanoBananaUrl(s.nanobananaBaseUrl);
          setNanoBananaKey(s.nanobananaApiKey ?? "");
          setAutoReplyEnabled(s.autoReplyEnabled ?? false);
          setAutoReplyGreenOnly(s.autoReplyGreenOnly ?? true);
        }
      } else {
        const text = await res.text();
        console.error("[Settings] Settings fetch failed:", res.status, text);
        setError(`Failed to load settings (${res.status})`);
      }

      // Load connected social accounts
      const accountsRes = await fetch("/api/settings/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setConnectedAccounts(accountsData.accounts ?? []);
      }

      // Load Ollama models
      console.log("[Settings] Fetching /api/ollama/health...");
      const healthRes = await fetch("/api/ollama/health");
      console.log("[Settings] Ollama health status:", healthRes.status);

      if (healthRes.ok) {
        const health = (await healthRes.json()) as OllamaModels;
        console.log("[Settings] Ollama models:", health.models);
        setAvailableModels(health.models ?? []);
        setOllamaOnline(true);
      } else {
        setOllamaOnline(false);
        console.warn("[Settings] Ollama offline or unreachable");
      }
    } catch (err) {
      console.error("[Settings] loadSettings exception:", err);
      setError("Network error loading settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!requireAuth()) return;
    const token = getToken();

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      console.log("[Settings] Saving to /api/settings...", {
        ollamaTextModel: textModel,
        ollamaEmbeddingsModel: embeddingsModel,
      });

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ollamaBaseUrl: ollamaUrl,
          ollamaTextModel: textModel,
          ollamaEmbeddingsModel: embeddingsModel,
          nanobananaBaseUrl: nanoBananaUrl,
          nanobananaApiKey: nanoBananaKey || null,
          autoReplyEnabled,
          autoReplyGreenOnly,
        }),
      });

      console.log("[Settings] PUT status:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("[Settings] Save success:", data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const text = await res.text();
        console.error("[Settings] Save failed:", res.status, text);
        setError(`Failed to save (${res.status})`);
      }
    } catch (err) {
      console.error("[Settings] Save exception:", err);
      setError("Network error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "brand", label: "Brand Profile", icon: Palette },
    { id: "connections", label: "Connections", icon: Link2 },
    { id: "ai", label: "AI Settings", icon: Key },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your account, brand, and AI integrations.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === id
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-6 pb-12">
          {/* ── AI Settings ── */}
          {tab === "ai" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">AI Settings</h2>

              {loading ? (
                <div className="flex items-center gap-3 py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading settings...
                </div>
              ) : (
                <>
                  {/* Ollama */}
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Ollama — Text Generation
                      </h3>
                      {ollamaOnline ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Online
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                          Offline
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Text Model
                        </label>
                        {availableModels.length > 0 ? (
                          <select
                            value={textModel}
                            onChange={(e) => setTextModel(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                          >
                            {availableModels.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={textModel}
                            onChange={(e) => setTextModel(e.target.value)}
                            placeholder="llama3.2:latest"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Embeddings Model
                        </label>
                        {availableModels.length > 0 ? (
                          <select
                            value={embeddingsModel}
                            onChange={(e) => setEmbeddingsModel(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                          >
                            {availableModels.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={embeddingsModel}
                            onChange={(e) => setEmbeddingsModel(e.target.value)}
                            placeholder="nomic-embed-text:latest"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                          />
                        )}
                      </div>
                    </div>

                    {availableModels.length > 0 && (
                      <p className="text-xs text-gray-400">
                        {availableModels.length} models detected on your Ollama instance
                      </p>
                    )}
                  </div>

                  {/* Nano Banana */}
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Nano Banana — Image Generation
                      </h3>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={nanoBananaKey}
                        onChange={(e) => setNanoBananaKey(e.target.value)}
                        placeholder={
                          nanoBananaKey ? "••••••••••••••••" : "Enter your API key"
                        }
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={nanoBananaUrl}
                        onChange={(e) => setNanoBananaUrl(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Auto-reply */}
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-700">Auto-Reply</h3>
                      <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">AI-powered</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Enable auto-reply</p>
                          <p className="text-xs text-gray-400">Automatically send AI-generated replies</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                          className={`w-11 h-6 rounded-full relative transition ${autoReplyEnabled ? "bg-violet-600" : "bg-gray-200"}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all ${autoReplyEnabled ? "right-0.5" : "left-0.5"}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">GREEN zone only</p>
                          <p className="text-xs text-gray-400">Only auto-reply on high-confidence suggestions</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoReplyGreenOnly(!autoReplyGreenOnly)}
                          className={`w-11 h-6 rounded-full relative transition ${autoReplyGreenOnly ? "bg-violet-600" : "bg-gray-200"}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all ${autoReplyGreenOnly ? "right-0.5" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <Check className="w-4 h-4" />
                    ) : null}
                    {saving ? "Saving..." : saved ? "Saved!" : "Save AI settings"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Account ── */}
          {tab === "account" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" defaultValue="Abdalla" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" defaultValue="abdalla@example.com" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
              </div>
              <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
                {saved && <Check className="w-4 h-4" />}
                {saved ? "Saved!" : "Save changes"}
              </button>
            </div>
          )}

          {/* ── Connections ── */}
          {tab === "connections" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
                <a
                  href={`/api/instagram/connect?workspaceId=${workspaceId}`}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
                >
                  <Plus className="w-4 h-4" />
                  Connect Instagram
                </a>
              </div>

              {connectedAccounts.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Instagram className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No Instagram accounts connected</p>
                  <p className="text-xs text-gray-400">Connect your Instagram Professional account to start publishing content.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedAccounts.map((account) => (
                    <div key={account.instagramId} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition">
                      <div className="flex items-center gap-3">
                        {account.profileImageUrl ? (
                          <img src={account.profileImageUrl} alt={account.username} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                            <Instagram className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">@{account.username}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              account.accountStatus === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {account.accountStatus === "ACTIVE" ? "Active" : "Pending Review"}
                            </span>
                            <span className="text-xs text-gray-400">
                              {account.isProfessional ? "Professional" : "Personal"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {account.followerCount !== null && (
                        <p className="text-xs text-gray-400">{Number(account.followerCount).toLocaleString()} followers</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Only Instagram Professional accounts (Business or Creator) can be connected.{" "}
                  <a
                    href="https://help.instagram.com/502981118235528"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-600"
                  >
                    Learn how to switch to a Professional account.
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* ── Brand ── */}
          {tab === "brand" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Brand Profile</h2>
              <p className="text-sm text-gray-500">Brand profiles are managed during onboarding.</p>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === "notifications" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <div className="space-y-4">
                {[
                  { label: "Post published", desc: "Get notified when a post goes live" },
                  { label: "Publish failed", desc: "Alert when a scheduled post fails" },
                  { label: "Weekly analytics", desc: "Receive a weekly performance summary" },
                  { label: "AI generation complete", desc: "Notify when content generation finishes" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <button className="w-10 h-6 rounded-full bg-violet-600 relative transition">
                      <div className="w-5 h-5 rounded-full bg-white shadow absolute top-0.5 right-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
