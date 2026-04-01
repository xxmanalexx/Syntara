"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PlusCircle, Search, FileText, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  READY: "bg-green-50 text-green-700 border-green-200",
  PUBLISHED: "bg-violet-100 text-violet-700 border-violet-200",
  ARCHIVED: "bg-gray-50 text-gray-400 border-gray-200",
};

const TYPE_COLORS: Record<string, string> = {
  FEED_POST: "bg-blue-50 text-blue-700",
  CAROUSEL: "bg-pink-50 text-pink-700",
  REEL: "bg-purple-50 text-purple-700",
  STORY: "bg-amber-50 text-amber-700",
};

interface DraftListItem {
  id: string;
  contentType: string;
  status: string;
  caption: string | null;
  readinessScore: number | null;
  updatedAt: string;
  brand: { id: string; name: string };
}

export default function DraftsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const token = localStorage.getItem("syntara_token");
    if (!token) {
      setError("Not logged in");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/drafts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = drafts.filter((d) => {
    if (filter !== "all" && d.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const caption = (d.caption ?? "").toLowerCase();
      const brand = d.brand?.name?.toLowerCase() ?? "";
      if (!caption.includes(q) && !brand.includes(q)) return false;
    }
    return true;
  });

  function timeAgo(date: string) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "..." : `${drafts.length} total draft${drafts.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
        >
          <PlusCircle className="w-5 h-5" />
          New Post
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by caption or brand..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "DRAFT", "READY", "PUBLISHED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize",
                filter === s
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading drafts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No drafts found</p>
          <Link href="/create" className="text-violet-600 text-sm font-medium mt-2 inline-block hover:text-violet-700">
            Create your first post →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => (
            <Link
              key={draft.id}
              href={`/drafts/${draft.id}`}
              className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition group"
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", TYPE_COLORS[draft.contentType] ?? "bg-gray-50 text-gray-600")}>
                    {draft.contentType.replace("_", " ")}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", STATUS_COLORS[draft.status] ?? "bg-gray-100 text-gray-600")}>
                    {draft.status}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{draft.brand?.name ?? "—"}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {draft.caption
                      ? draft.caption.slice(0, 100).replace(/\n/g, " ")
                      : <span className="italic text-gray-400">No caption yet</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(draft.updatedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                {draft.status !== "PUBLISHED" && draft.readinessScore != null && (
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">Score</p>
                    <p
                      className={cn(
                        "text-sm font-bold",
                        draft.readinessScore >= 80
                          ? "text-green-600"
                          : draft.readinessScore >= 50
                          ? "text-amber-600"
                          : "text-red-500"
                      )}
                    >
                      {draft.readinessScore}
                    </p>
                  </div>
                )}
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!confirm(`Delete this draft?`)) return;
                    const token = localStorage.getItem("syntara_token");
                    await fetch(`/api/drafts/${draft.id}`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    load();
                  }}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                  title="Delete draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
