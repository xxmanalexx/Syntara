"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Inbox, Instagram, Filter } from "lucide-react";
import type { ConversationStatus, ChannelType } from "@prisma/client";

interface ConversationContact {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
}

interface Conversation {
  id: string;
  channel: ChannelType;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  ig_post_caption: string | null;
  ig_post_permalink: string | null;
  ig_media_id: string | null;
  contact: ConversationContact;
  lead?: { id: string; status: string; first_name?: string | null; last_name?: string | null } | null;
  assignedTo?: { id: string; user: { name?: string | null; email: string } } | null;
}

export default function InboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "ALL">("ALL");
  const [channelFilter, setChannelFilter] = useState<ChannelType | "ALL">("ALL");

  useEffect(() => {
    fetchConversations();
  }, [statusFilter, channelFilter]);

  async function syncComments() {
    setSyncing(true);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/cron/poll-comments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchConversations();
      } else {
        await fetchConversations();
      }
    } catch (err) {
      console.error("[InboxPage] sync error:", err);
    } finally {
      setSyncing(false);
    }
  }

  async function fetchConversations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (channelFilter !== "ALL") params.set("channel", channelFilter);

      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/inbox/conversations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch (err) {
      console.error("[InboxPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  function getContactName(c: Conversation) {
    return c.contact.displayName ?? c.contact.username ?? "Unknown";
  }

  function getInitials(c: Conversation) {
    const name = getContactName(c);
    return name.slice(0, 2).toUpperCase();
  }

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "";
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  }

  const statusOptions: { value: ConversationStatus | "ALL"; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "OPEN", label: "Open" },
    { value: "CLOSED", label: "Closed" },
    { value: "ARCHIVED", label: "Archived" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Inbox</h2>
            <p className="text-sm text-gray-500">{conversations.filter(c => c.unread_count > 0).length} unread</p>
          </div>
        </div>
        <button
          onClick={syncComments}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
        >
          <Instagram className="w-4 h-4" />
          {syncing ? "Syncing..." : "Sync from Instagram"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                statusFilter === opt.value
                  ? "bg-violet-100 text-violet-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No conversations yet</p>
          <p className="text-sm text-gray-400 mt-1">Incoming messages will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => router.push(`/inbox/${conv.id}`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-violet-200 hover:shadow-sm transition group"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {conv.contact.profileImageUrl ? (
                    <img
                      src={conv.contact.profileImageUrl}
                      alt={getContactName(conv)}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-sm font-bold">
                      {getInitials(conv)}
                    </div>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">
                      {conv.unread_count > 9 ? "9+" : conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold text-sm truncate ${conv.unread_count > 0 ? "text-gray-900" : "text-gray-700"}`}>
                      {getContactName(conv)}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 truncate flex-1">
                      {conv.last_message_preview || "(no messages)"}
                    </span>
                  </div>
                  {conv.ig_post_caption && (
                    <div className="flex items-start gap-1.5 mt-1.5">
                      <Instagram className="w-3 h-3 text-pink-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-400 truncate italic flex-1">
                        "{conv.ig_post_caption.slice(0, 80)}{conv.ig_post_caption.length > 80 ? "…" : ""}"
                      </p>
                      {conv.ig_post_permalink && (
                        <a
                          href={conv.ig_post_permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-pink-500 hover:text-pink-700 flex-shrink-0 ml-1"
                        >
                          View post →
                        </a>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {conv.channel === "INSTAGRAM" && (
                      <span className="inline-flex items-center gap-1 text-xs text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                        <Instagram className="w-3 h-3" />
                        IG
                      </span>
                    )}
                    {conv.lead && (
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                        Lead: {conv.lead.status}
                      </span>
                    )}
                    {conv.assignedTo && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                        {conv.assignedTo.user.name ?? conv.assignedTo.user.email}
                      </span>
                    )}
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                      conv.status === "OPEN" ? "bg-green-50 text-green-600" :
                      conv.status === "CLOSED" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-50 text-yellow-600"
                    }`}>
                      {conv.status}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
