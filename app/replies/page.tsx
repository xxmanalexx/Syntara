"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Plus, Search, Zap, AlertTriangle, AlertCircle, Trash2, Edit3 } from "lucide-react";

interface SavedReply {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  response_zone: "GREEN" | "YELLOW" | "RED";
  is_active: boolean;
}

const ZONE_CONFIG = {
  GREEN: { label: "Auto-reply", color: "bg-green-100 text-green-700", icon: Zap, bg: "bg-green-50 border-green-200" },
  YELLOW: { label: "Needs review", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle, bg: "bg-yellow-50 border-yellow-200" },
  RED: { label: "Escalate", color: "bg-red-100 text-red-700", icon: AlertCircle, bg: "bg-red-50 border-red-200" },
};

export default function RepliesPage() {
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SavedReply | null>(null);
  const [form, setForm] = useState({ title: "", content: "", shortcut: "", category: "general", response_zone: "GREEN" as "GREEN" | "YELLOW" | "RED" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { fetchReplies(); }, []);

  async function fetchReplies() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/templates/saved-replies", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setReplies((await res.json()).replies ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const url = editing ? `/api/templates/saved-replies/${editing.id}` : "/api/templates/saved-replies";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) { setShowModal(false); setEditing(null); setForm({ title: "", content: "", shortcut: "", category: "general", response_zone: "GREEN" }); fetchReplies(); }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved reply?")) return;
    setDeleting(id);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/templates/saved-replies/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setReplies((r) => r.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(reply: SavedReply) {
    setEditing(reply);
    setForm({ title: reply.title, content: reply.content, shortcut: reply.shortcut ?? "", category: reply.category, response_zone: reply.response_zone });
    setShowModal(true);
  }

  const filtered = replies.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase()) ||
    (r.shortcut ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Saved Replies</h2>
            <p className="text-sm text-gray-500">{replies.length} replies</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ title: "", content: "", shortcut: "", category: "general", response_zone: "GREEN" }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Reply
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search replies..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{search ? "No replies match your search" : "No saved replies yet"}</p>
          <p className="text-sm text-gray-400 mt-1">{search ? "Try a different search term" : "Create your first saved reply to speed up responses"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((reply) => {
            const zone = ZONE_CONFIG[reply.response_zone];
            const ZoneIcon = zone.icon;
            return (
              <div key={reply.id} className={`rounded-xl border ${zone.bg} p-4 flex flex-col gap-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {reply.shortcut && (
                      <span className="text-xs font-mono bg-white/70 border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                        #{reply.shortcut}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${zone.color}`}>
                      <ZoneIcon className="w-3 h-3" />
                      {zone.label}
                    </span>
                    {reply.category && reply.category !== "general" && (
                      <span className="text-xs text-gray-400">{reply.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(reply)} className="p-1 hover:bg-white/60 rounded-lg transition"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => handleDelete(reply.id)} disabled={deleting === reply.id} className="p-1 hover:bg-white/60 rounded-lg transition">
                      <Trash2 className={`w-3.5 h-3.5 ${deleting === reply.id ? "text-red-300" : "text-red-400"}`} />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{reply.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{reply.content.slice(0, 120)}{reply.content.length > 120 ? "…" : ""}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editing ? "Edit Reply" : "New Saved Reply"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Pricing info" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Shortcut (optional)</label>
                  <input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="e.g. price" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Reply Content *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                  rows={4}
                  placeholder="Write your saved reply..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="general" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Response Zone</label>
                  <select value={form.response_zone} onChange={(e) => setForm({ ...form, response_zone: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400">
                    <option value="GREEN">🟢 Auto-reply</option>
                    <option value="YELLOW">🟡 Needs review</option>
                    <option value="RED">🔴 Escalate</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 transition disabled:opacity-50">
                  {saving ? "Saving..." : editing ? "Update Reply" : "Create Reply"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
