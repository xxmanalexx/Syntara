"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle, TrendingUp, FileText, Clock, ChevronRight, AlertCircle } from "lucide-react";

// Mock data for dashboard
const MOCK_STATS = [
  { label: "Published Posts", value: "24", delta: "+3 this week", icon: FileText, color: "violet" },
  { label: "Total Reach", value: "18.4K", delta: "+12% vs last week", icon: TrendingUp, color: "green" },
  { label: "Scheduled", value: "5", delta: "Next in 2h", icon: Clock, color: "amber" },
  { label: "Avg. Engagement", value: "4.8%", delta: "+0.3% vs last week", icon: TrendingUp, color: "blue" },
];

const MOCK_RECENT_DRAFTS = [
  { id: "1", brandName: "Glow Botanicals", contentType: "FEED_POST", status: "DRAFT", updatedAt: "2h ago", readinessScore: 78 },
  { id: "2", brandName: "Glow Botanicals", contentType: "CAROUSEL", status: "READY", updatedAt: "5h ago", readinessScore: 91 },
  { id: "3", brandName: "Glow Botanicals", contentType: "REEL", status: "DRAFT", updatedAt: "1d ago", readinessScore: 55 },
];

const MOCK_TOP_POSTS = [
  { id: "p1", caption: "Introducing our new morning ritual set...", likes: 342, comments: 28, type: "FEED_POST", publishedAt: "3d ago" },
  { id: "p2", caption: "The 3-step routine for glowing skin...", likes: 289, comments: 41, type: "CAROUSEL", publishedAt: "1w ago" },
  { id: "p3", caption: "Behind the scenes: our botanical farm...", likes: 201, comments: 17, type: "REEL", publishedAt: "2w ago" },
];

const COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  gray: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function DashboardPage() {
  const [healthStatus, setHealthStatus] = useState<{ ollama: boolean; nanobanana: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/ollama/health")
      .then((r) => r.json())
      .then((d) => setHealthStatus((s) => ({ ...s!, ollama: d.ok })))
      .catch(() => setHealthStatus((s) => ({ ...s!, ollama: false })));
  }, []);

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
        {MOCK_STATS.map(({ label, value, delta, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                <p className="text-xs text-gray-400 mt-1">{delta}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${COLOR_MAP[color].replace("50", "100").replace("-700", "-500").replace("-50", "100").replace("text-", "text-opacity-80 bg-")}`}
                style={{ backgroundColor: color === "violet" ? "#f5f3ff" : color === "green" ? "#f0fdf4" : color === "amber" ? "#fffbeb" : "#eff6ff" }}
              >
                <Icon className={`w-5 h-5`} style={{ color: color === "violet" ? "#7c3aed" : color === "green" ? "#16a34a" : color === "amber" ? "#d97706" : "#2563eb" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Drafts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Drafts</h2>
          <Link href="/drafts" className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {MOCK_RECENT_DRAFTS.map((draft) => (
            <Link key={draft.id} href={`/drafts/${draft.id}`}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition group">
              <div className="flex items-center gap-4">
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${draft.status === "READY" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {draft.contentType.replace("_", " ")}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{draft.brandName}</p>
                  <p className="text-xs text-gray-400">{draft.updatedAt}</p>
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
      </div>

      {/* Top Performing Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Top Performing</h2>
          <Link href="/analytics" className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            Full analytics <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MOCK_TOP_POSTS.map((post) => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm text-gray-700 line-clamp-2 mb-3">{post.caption}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>❤️ {post.likes}</span>
                <span>💬 {post.comments}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_MAP.violet}`}>
                  {post.type.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
