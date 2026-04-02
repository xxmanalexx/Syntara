"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, TrendingUp, FileText, Clock, ChevronRight, AlertCircle } from "lucide-react";

interface DashboardStats {
  publishedCount: number;
  scheduledCount: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagement: number;
}

interface RecentDraft {
  id: string;
  brandName: string;
  contentType: string;
  status: string;
  updatedAt: string;
  readinessScore: number;
  hasImage: boolean;
}

interface RecentPublished {
  id: string;
  instagramId: string | null;
  permalink: string | null;
  username: string | null;
  attemptedAt: string;
}

interface TopPost {
  id: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  postUrl: string | null;
  publishedAt: string | null;
}

const COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<RecentDraft[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<{ ollama: boolean } | null>(null);

  useEffect(() => {
    // Check Ollama health
    fetch("/api/ollama/health")
      .then((r) => r.json())
      .then((d) => setHealthStatus({ ollama: d.ok }))
      .catch(() => setHealthStatus({ ollama: false }));

    // Fetch real dashboard data
    fetch("/api/dashboard", {
      headers: { Authorization: `Bearer ${localStorage.getItem("syntara_token") ?? ""}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setRecentDrafts(d.recentDrafts ?? []);
        setTopPosts(d.topPosts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-gray-100" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Your Instagram content at a glance.</p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
        >
          <PlusCircle className="w-5 h-5" />
          New Post
        </Link>
      </div>

      {/* System Health */}
      {healthStatus && !healthStatus.ollama && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            <strong>Ollama is offline.</strong> Content generation requires Ollama to be running locally.
          </p>
          <Link href="/settings" className="ml-auto text-sm font-medium underline">Fix in settings</Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Published Posts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.publishedCount ?? 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">all time</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Reach</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCount(stats?.totalReach ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatCount(stats?.totalImpressions ?? 0)} impressions
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Scheduled</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.scheduledCount ?? 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">queued</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Avg. Engagement</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.avgEngagement ?? 0}%
              </p>
              <p className="text-xs text-gray-400 mt-1">likes + comments + saves</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Drafts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Drafts</h2>
          <Link href="/drafts" className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {recentDrafts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">No drafts yet.</p>
            <Link href="/create" className="text-violet-600 text-sm font-medium mt-1 inline-block hover:underline">
              Create your first post
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentDrafts.map((draft) => (
              <Link key={draft.id} href={`/drafts/${draft.id}`}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition group">
                <div className="flex items-center gap-4">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${draft.status === "READY" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {draft.contentType.replace("_", " ")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{draft.brandName}</p>
                    <p className="text-xs text-gray-400">{timeAgo(draft.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">Score</p>
                    <p className={`text-sm font-semibold ${draft.readinessScore >= 80 ? "text-green-600" : draft.readinessScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                      {draft.readinessScore}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top Performing Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Top Performing</h2>
          <Link href="/analytics" className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            Full analytics <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {topPosts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">No published posts yet. Analytics will appear here after your first post.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-700 line-clamp-2 mb-3">{post.caption || "(no caption)"}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>❤️ {post.likesCount}</span>
                  <span>💬 {post.commentsCount}</span>
                  {post.postUrl && (
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-violet-600 hover:underline text-xs"
                    >
                      View →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
