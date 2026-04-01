"use client";

import { useState } from "react";
import { Settings, User, Palette, Link2, Key, Bell, ExternalLink, Check, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const [tab, setTab] = useState<"account" | "brand" | "connections" | "ai" | "notifications">("account");
  const [saved, setSaved] = useState(false);

  const TABS = [
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
        <p className="text-gray-500 mt-1">Manage your account, brand, and integrations.</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === id ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-6">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" defaultValue="••••••••" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
                {saved && <Check className="w-4 h-4" />}
                {saved ? "Saved!" : "Save changes"}
              </button>
            </div>
          )}

          {tab === "connections" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Instagram</p>
                      <p className="text-xs text-gray-500">@glowbotanicals · Business Account</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Connected</span>
                    <button className="text-sm text-red-500 hover:text-red-600 font-medium">Disconnect</button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-dashed border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Connect another account</p>
                      <p className="text-xs text-gray-400">Link a new Instagram Professional account</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 rounded-lg border border-violet-200 text-violet-600 text-sm font-medium hover:bg-violet-50 transition">
                    Connect
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "ai" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">AI Settings</h2>

              {/* Ollama */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">Ollama (Text Generation)</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Online</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                  <input type="text" defaultValue="http://localhost:11434" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Text Model</label>
                    <input type="text" defaultValue="llama3.2:latest" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Embeddings Model</label>
                    <input type="text" defaultValue="nomic-embed-text:latest" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                  </div>
                </div>
              </div>

              {/* Nano Banana */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">Nano Banana (Image Generation)</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Online</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                  <input type="password" defaultValue="nbak_••••••••••••" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                  <input type="text" defaultValue="https://api.nanobanana.io/v1" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                </div>
              </div>

              <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
                {saved && <Check className="w-4 h-4" />}
                {saved ? "Saved!" : "Save AI settings"}
              </button>
            </div>
          )}

          {tab === "brand" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Brand Profile</h2>
              <p className="text-sm text-gray-500">Manage your brand profile used for AI content generation.</p>
              <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 text-sm text-violet-700">
                Brand profiles are managed during onboarding or from the dashboard.
              </div>
            </div>
          )}

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
