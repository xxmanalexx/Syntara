"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, Search, Filter, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_DRAFTS = [
  { id: "1", brandName: "Glow Botanicals", contentType: "FEED_POST", status: "DRAFT", updatedAt: "2h ago", readinessScore: 78, caption: "New product launch teaser..." },
  { id: "2", brandName: "Glow Botanicals", contentType: "CAROUSEL", status: "READY", updatedAt: "5h ago", readinessScore: 91, caption: "The complete morning routine..." },
  { id: "3", brandName: "Glow Botanicals", contentType: "REEL", status: "DRAFT", updatedAt: "1d ago", readinessScore: 55, caption: "Behind the scenes at our farm..." },
  { id: "4", brandName: "Glow Botanicals", contentType: "STORY", status: "ARCHIVED", updatedAt: "3d ago", readinessScore: 100, caption: "Limited time offer..." },
  { id: "5", brandName: "Glow Botanicals", contentType: "FEED_POST", status: "PUBLISHED", updatedAt: "1w ago", readinessScore: 100, caption: "Customer testimonial..." },
];

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

export default function DraftsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = MOCK_DRAFTS.filter((d) => {
    if (filter !== "all" && d.status !== filter) return false;
    if (search && !d.caption.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
          <p className="text-gray-500 mt-1">{MOCK_DRAFTS.length} total drafts</p>
        </div>
        <Link href="/create" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
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
            placeholder="Search drafts..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {["all", "DRAFT", "READY", "PUBLISHED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize",
                filter === s ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Drafts list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No drafts found</p>
            <Link href="/create" className="text-violet-600 text-sm font-medium mt-2 inline-block hover:text-violet-700">
              Create your first post →
            </Link>
          </div>
        ) : (
          filtered.map((draft) => (
            <Link key={draft.id} href={`/drafts/${draft.id}`}
              className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition group">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", TYPE_COLORS[draft.contentType])}>
                    {draft.contentType.replace("_", " ")}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_COLORS[draft.status])}>
                    {draft.status}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{draft.brandName}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{draft.caption}</p>
                  <p className="text-xs text-gray-400 mt-1">{draft.updatedAt}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                {draft.status !== "PUBLISHED" && (
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">Score</p>
                    <p className={cn(
                      "text-sm font-bold",
                      draft.readinessScore >= 80 ? "text-green-600" :
                      draft.readinessScore >= 50 ? "text-amber-600" : "text-red-500"
                    )}>
                      {draft.readinessScore}
                    </p>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
