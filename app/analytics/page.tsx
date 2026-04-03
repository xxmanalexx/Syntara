"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Heart, MessageCircle, Bookmark, Eye, RefreshCw, ExternalLink, Search, Loader2, Hash } from "lucide-react";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Post {
  id: string;
  instagramMediaId: string | null;
  caption: string;
  postUrl: string;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  reach: number;
  impressions: number;
  publishedAt: string | null;
  postType: string;
  score: number;
}

interface Summary {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagement: number;
  followerCount: number;
  igUsername: string | null;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"analytics" | "research">("analytics");
  // Research state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [researchResults, setResearchResults] = useState<any[]>([]);
  const [researchError, setResearchError] = useState("");
  const [hashtags, setHashtags] = useState<any[]>([]);

  async function loadAnalytics() {
    const token = localStorage.getItem("syntara_token") ?? "";
    const res = await fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSummary(data.summary);
      setPosts(data.posts ?? []);
    }
    setLoading(false);
  }

  async function syncNow() {
    setSyncing(true);
    const token = localStorage.getItem("syntara_token") ?? "";
    await fetch("/api/analytics/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAnalytics();
    setSyncing(false);
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function handleResearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setResearchError("");
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/hashtag-research?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setResearchError(data.error ?? "Search failed"); return; }
      setHashtags(data.hashtags ?? []);
      setResearchResults(data.results ?? []);
    } catch {
      setResearchError("Network error. Try again.");
    } finally {
      setSearching(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">
            {summary?.igUsername ? `@${summary.igUsername}` : "Instagram"} · Synced just now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === "analytics" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("research")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${activeTab === "research" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Hash className="w-3.5 h-3.5" />
              Research
            </button>
          </div>
          {activeTab === "analytics" && (
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from Instagram"}
            </button>
          )}
        </div>
      </div>

      {/* Research Tab */}
      {activeTab === "research" && (
        <ResearchTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleResearch={handleResearch}
          searching={searching}
          hashtags={hashtags}
          results={researchResults}
          error={researchError}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <AnalyticsContent summary={summary} posts={posts} syncing={syncing} syncNow={syncNow} />
      )}
    </div>
  );
}

// ── Analytics Content ────────────────────────────────────────────────

function AnalyticsContent({ summary, posts, syncing, syncNow }: {
  summary: Summary | null;
  posts: Post[];
  syncing: boolean;
  syncNow: () => void;
}) {
  if (!summary) return null;
  return summary.totalPosts === 0 ? (
    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
      <p className="text-gray-400 text-lg font-medium mb-2">No analytics yet</p>
      <p className="text-gray-400 text-sm mb-6">Publish your first post and sync to see your analytics here.</p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/drafts" className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition font-medium">
          View Drafts
        </Link>
        <button onClick={syncNow} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition">
          Sync Instagram
        </button>
      </div>
    </div>
  ) : (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500 font-medium">Total Posts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalPosts}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-1">
            <p className="text-sm text-gray-500 font-medium">Total Reach</p>
            {summary.totalReach > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : null}
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCount(summary.totalReach)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500 font-medium">Total Likes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCount(summary.totalLikes)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-1">
            <p className="text-sm text-gray-500 font-medium">Avg Engagement</p>
            {summary.avgEngagement > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : null}
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avgEngagement}%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Comments", value: formatCount(summary.totalComments), icon: MessageCircle },
          { label: "Saves", value: formatCount(summary.totalSaves), icon: Bookmark },
          { label: "Impressions", value: formatCount(summary.totalImpressions), icon: Eye },
          { label: "Followers", value: formatCount(summary.followerCount), icon: Heart },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
              <Icon className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Posts</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Post</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">❤️</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">💬</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">🔖</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">👁️</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-800 line-clamp-2 text-xs">{post.caption || "(no caption)"}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-gray-500 font-medium">{post.postType?.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{post.likesCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{post.commentsCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{post.savesCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{post.reach > 0 ? formatCount(post.reach) : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                    {post.publishedAt ? formatDate(post.publishedAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {post.postUrl && (
                      <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-700 transition">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Research Tab ──────────────────────────────────────────────────────

function ResearchTab({ searchQuery, setSearchQuery, handleResearch, searching, hashtags, results, error }: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  handleResearch: (e?: React.FormEvent) => Promise<void>;
  searching: boolean;
  hashtags: any[];
  results: any[];
  error: string;
}) {
  function fmtCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <form onSubmit={handleResearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hashtags (e.g. skincare, travel, fitness)"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !searchQuery.trim()}
          className="px-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {results.length === 0 && !searching && !error && (
        <div className="text-center py-12 text-gray-400">
          <Hash className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">Discover top-performing posts by hashtag</p>
          <p className="text-sm mt-1">Search for any hashtag to see posts ranked by engagement</p>
        </div>
      )}

      {/* Hashtag chips */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hashtags.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-sm font-medium">
              #{h.name}
            </span>
          ))}
        </div>
      )}

      {/* Results — grouped by hashtag */}
      {results.map((group) => (
        <div key={group.hashtag} className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">#{group.hashtag}</h3>
            <span className="text-sm text-gray-400">{group.posts.length} posts</span>
          </div>

          {group.posts.length === 0 ? (
            <p className="text-sm text-gray-400">No recent posts found for this hashtag.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.posts.map((post: any) => (
                <div key={post.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-violet-600">{post.mediaType === "IMAGE" ? "📷" : "🎬"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 line-clamp-2">{post.caption || "(no caption)"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">❤️ {fmtCount(post.likeCount)}</span>
                      <span className="flex items-center gap-1">💬 {fmtCount(post.commentsCount)}</span>
                    </div>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 hover:text-violet-700"
                    >
                      View ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
