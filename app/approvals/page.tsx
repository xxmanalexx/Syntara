"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, MessageSquare, Bot, Clock, Instagram, AlertCircle } from "lucide-react";

interface DraftMessage {
  id: string;
  content: string | null;
  createdAt: string;
  ai_intent: string | null;
  ai_confidence: number | null;
  ai_suggestion: string | null;
  response_zone: string | null;
  conversation: {
    id: string;
    ig_post_caption: string | null;
    ig_post_permalink: string | null;
    ig_media_id: string | null;
    contact: { displayName: string | null; username: string | null; profileImageUrl: string | null };
    lead: { id: string; first_name: string | null; last_name: string | null; status: string } | null;
  };
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ZoneBadge({ zone }: { zone: string | null }) {
  if (!zone) return null;
  const map: Record<string, string> = {
    GREEN: "bg-green-100 text-green-700 border-green-200",
    YELLOW: "bg-yellow-100 text-yellow-700 border-yellow-200",
    RED: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[zone] ?? "bg-gray-100 text-gray-600"}`}>
      {zone}
    </span>
  );
}

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<DraftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { fetchDrafts(); }, []);

  async function fetchDrafts() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/approvals", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDrafts((await res.json()).drafts ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(messageId: string, action: "approve" | "reject") {
    setProcessing(messageId);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId, action }),
      });
      if (res.ok) {
        setDrafts((ds) => ds.filter((d) => d.id !== messageId));
      } else {
        const err = await res.json();
        alert(`Action failed: ${err.error}`);
      }
    } finally {
      setProcessing(null);
    }
  }

  function getContactName(draft: DraftMessage) {
    return draft.conversation.contact.displayName ?? draft.conversation.contact.username ?? "Unknown";
  }

  function getInitials(draft: DraftMessage) {
    return getContactName(draft).slice(0, 2).toUpperCase();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Draft Approvals</h2>
            <p className="text-sm text-gray-500">{drafts.length} pending {drafts.length === 1 ? "draft" : "drafts"}</p>
          </div>
        </div>
        <button
          onClick={fetchDrafts}
          className="text-sm text-gray-400 hover:text-violet-600 transition"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />)}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-xl border border-gray-100">
          <CheckCircle className="w-14 h-14 text-green-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-500">All caught up!</p>
          <p className="text-sm text-gray-400 mt-1">No pending AI drafts to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const contactName = getContactName(draft);
            const isProc = processing === draft.id;
            return (
              <div key={draft.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {getInitials(draft)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{contactName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {draft.conversation.ig_post_caption && (
                          <span className="flex items-center gap-1 text-xs text-pink-500">
                            <Instagram className="w-3 h-3" />
                            comment
                          </span>
                        )}
                        {draft.ai_intent && (
                          <span className="text-xs text-gray-400 capitalize">{draft.ai_intent.replace(/_/g, " ")}</span>
                        )}
                        {draft.ai_confidence != null && (
                          <span className="text-xs text-violet-500">{Math.round(draft.ai_confidence * 100)}% confident</span>
                        )}
                        <ZoneBadge zone={draft.response_zone} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(draft.createdAt)}
                  </div>
                </div>

                {/* Post context */}
                {draft.conversation.ig_post_caption && (
                  <div className="mb-4 pl-4 border-l-2 border-pink-200 bg-pink-50/50 rounded-r-lg py-2 pr-3">
                    <p className="text-xs text-pink-400 font-medium mb-0.5 flex items-center gap-1">
                      <Instagram className="w-3 h-3" /> Comment on your post
                    </p>
                    <p className="text-xs text-gray-600 italic">
                      "{draft.conversation.ig_post_caption.slice(0, 100)}{draft.conversation.ig_post_caption.length > 100 ? "…" : ""}"
                    </p>
                    {draft.conversation.ig_post_permalink && (
                      <a href={draft.conversation.ig_post_permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-500 hover:text-pink-700 mt-1 inline-block">
                        View post →
                      </a>
                    )}
                  </div>
                )}

                {/* Suggested reply */}
                <div className="mb-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Suggested Reply</p>
                  <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-800 leading-relaxed">{draft.content ?? "(empty)"}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAction(draft.id, "approve")}
                    disabled={isProc}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isProc ? "Sending..." : "Approve & Send"}
                  </button>
                  <button
                    onClick={() => handleAction(draft.id, "reject")}
                    disabled={isProc}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => window.open(`/inbox/${draft.conversation.id}`, "_blank")}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm hover:bg-gray-50 transition"
                    title="View conversation"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Context
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}