"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Heart, MessageCircle, Bookmark, Eye, Sparkles } from "lucide-react";

const MOCK_ANALYTICS = {
  totalPosts: 24,
  totalLikes: 3842,
  totalComments: 287,
  totalSaves: 561,
  avgEngagementRate: 4.8,
  followerCount: 8420,
  followerDelta: 312,
  topFormat: "CAROUSEL",
  topHookPattern: "Question-based",
  topCtaPattern: "Link in bio",
  aiSummary: "Your carousel posts are your strongest format with 2.3x the engagement of feed posts. Question-based hooks are performing exceptionally well. Consider testing 'save' CTAs more frequently — saves correlate strongly with your top-performing posts.",
};

const MOCK_POSTS = [
  { id: "1", caption: "Introducing our new morning ritual set...", type: "FEED_POST", likes: 342, comments: 28, saves: 47, reach: 4200, publishedAt: "3d ago", score: 87 },
  { id: "2", caption: "The 3-step routine for glowing skin. Swipe!", type: "CAROUSEL", likes: 521, comments: 63, saves: 112, reach: 8300, publishedAt: "1w ago", score: 94 },
  { id: "3", caption: "Behind the scenes: our botanical farm...", type: "REEL", likes: 289, comments: 41, saves: 38, reach: 6100, publishedAt: "2w ago", score: 79 },
  { id: "4", caption: "Customer spotlight: Sarah's glow-up journey", type: "FEED_POST", likes: 198, comments: 52, saves: 89, reach: 3100, publishedAt: "3w ago", score: 82 },
];

const MOCK_WEEKLY = [
  { label: "Mon", likes: 120, comments: 8 },
  { label: "Tue", likes: 340, comments: 22 },
  { label: "Wed", likes: 280, comments: 15 },
  { label: "Thu", likes: 450, comments: 41 },
  { label: "Fri", likes: 390, comments: 33 },
  { label: "Sat", likes: 510, comments: 38 },
  { label: "Sun", likes: 220, comments: 12 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const maxLikes = Math.max(...MOCK_WEEKLY.map((d) => d.likes));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your Instagram performance.</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${period === p ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Followers", value: MOCK_ANALYTICS.followerCount.toLocaleString(), delta: `+${MOCK_ANALYTICS.followerDelta}`, deltaUp: true, icon: Eye },
          { label: "Avg. Engagement", value: `${MOCK_ANALYTICS.avgEngagementRate}%`, delta: "+0.3%", deltaUp: true, icon: Heart },
          { label: "Total Likes", value: MOCK_ANALYTICS.totalLikes.toLocaleString(), delta: "+18%", deltaUp: true, icon: Heart },
          { label: "Total Saves", value: MOCK_ANALYTICS.totalSaves.toLocaleString(), delta: "+24%", deltaUp: true, icon: Bookmark },
        ].map(({ label, value, delta, deltaUp, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {deltaUp ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
              <span className={`text-xs font-medium ${deltaUp ? "text-green-600" : "text-red-600"}`}>{delta}</span>
              <span className="text-xs text-gray-400">vs last period</span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-6">Weekly Engagement</h3>
        <div className="flex items-end justify-between gap-2 h-40">
          {MOCK_WEEKLY.map(({ label, likes }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex flex-col items-center gap-1" style={{ height: "120px" }}>
                <div
                  className="w-full rounded-t-lg bg-violet-200 transition-all hover:bg-violet-300"
                  style={{ height: `${(likes / maxLikes) * 100}%`, minHeight: "4px" }}
                />
              </div>
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-200" />
            <span className="text-xs font-semibold text-violet-200 uppercase tracking-wide">Top Format</span>
          </div>
          <p className="text-2xl font-bold mb-1">{MOCK_ANALYTICS.topFormat}</p>
          <p className="text-sm text-violet-100">2.3x more engagement than feed posts</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Top Hook Style</span>
          </div>
          <p className="text-2xl font-bold mb-1">{MOCK_ANALYTICS.topHookPattern}</p>
          <p className="text-sm text-amber-100">Highest avg. engagement rate</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">Best CTA</span>
          </div>
          <p className="text-2xl font-bold mb-1">{MOCK_ANALYTICS.topCtaPattern}</p>
          <p className="text-sm text-emerald-100">Strongest save correlation</p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-700">AI Insight Summary</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{MOCK_ANALYTICS.aiSummary}</p>
      </div>

      {/* Top posts table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Top Performing Posts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Post", "Type", "Likes", "Comments", "Saves", "Reach", "Score"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_POSTS.map((post) => (
                <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-700 max-w-xs truncate">{post.caption}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{post.publishedAt}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">{post.type.replace("_", " ")}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">❤️ {post.likes}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">💬 {post.comments}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">🔖 {post.saves}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">👁 {post.reach.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`text-sm font-bold ${post.score >= 90 ? "text-green-600" : post.score >= 70 ? "text-amber-600" : "text-red-500"}`}>
                      {post.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
