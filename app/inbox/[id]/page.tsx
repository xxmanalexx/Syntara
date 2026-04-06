"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, Send, CheckCircle, AlertCircle, Bot, User, Instagram } from "lucide-react";

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string | null;
  status: string;
  ai_intent: string | null;
  ai_confidence: number | null;
  ai_suggestion: string | null;
  response_zone: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
}

interface Conversation {
  id: string;
  channel: string;
  status: string;
  ig_post_caption: string | null;
  ig_post_permalink: string | null;
  ig_media_id: string | null;
  lead?: { id: string; status: string; first_name?: string | null } | null;
  assignedTo?: { id: string; user: { name?: string | null; email: string } } | null;
  contact: Contact;
  messages: Message[];
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    if (conversation?.messages.length) scrollToBottom();
  }, [conversation?.messages]);

  async function fetchConversation() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/inbox/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
      }
    } catch (err) {
      console.error("[ConversationPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/inbox/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchConversation();
    } catch (err) {
      console.error("[ConversationPage] status change error:", err);
    }
  }

  async function handleSend() {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      if (res.ok) {
        setReplyText("");
        await fetchConversation();
      }
    } catch (err) {
      console.error("[ConversationPage] send error:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleApprove(messageId: string) {
    setApproving(true);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/inbox/conversations/${conversationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        await fetchConversation();
      }
    } catch (err) {
      console.error("[ConversationPage] approve error:", err);
    } finally {
      setApproving(false);
    }
  }

  const aiDraftMessage = conversation?.messages.find(
    (m) => m.status === "AI_DRAFT" && m.direction === "OUTBOUND",
  );

  function getContactName() {
    if (!conversation) return "";
    return conversation.contact.displayName ?? conversation.contact.username ?? "Unknown";
  }

  function getInitials() {
    return getContactName().slice(0, 2).toUpperCase();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Loading conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Conversation not found</p>
        <button onClick={() => router.push("/inbox")} className="mt-4 text-violet-600 hover:underline">
          Back to inbox
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
        <button onClick={() => router.push("/inbox")} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {conversation.contact.profileImageUrl ? (
          <img
            src={conversation.contact.profileImageUrl}
            alt={getContactName()}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {getInitials()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{getContactName()}</h2>
            <div className="flex items-center gap-2">
              <select
                value={conversation.status}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-violet-400"
              >
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <button
                onClick={fetchConversation}
                className="text-xs text-gray-400 hover:text-violet-600 transition"
                title="Reload messages"
              >
                ↻
              </button>
            </div>
          </div>
          {conversation.ig_post_caption && (
            <div className="flex items-start gap-1.5 mt-1">
              <Instagram className="w-3 h-3 text-pink-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-400 truncate italic flex-1">
                "{conversation.ig_post_caption.slice(0, 60)}{conversation.ig_post_caption.length > 60 ? "…" : ""}"
              </p>
              {conversation.ig_post_permalink && (
                <a
                  href={conversation.ig_post_permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-pink-500 hover:text-pink-700 flex-shrink-0"
                >
                  View post →
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestion bar */}
      {aiDraftMessage?.ai_suggestion && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-violet-700">AI Suggestion</span>
                {aiDraftMessage.ai_confidence != null && (
                  <span className="text-xs text-violet-500">
                    {Math.round(aiDraftMessage.ai_confidence * 100)}% confidence
                  </span>
                )}
                {aiDraftMessage.response_zone && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    aiDraftMessage.response_zone === "GREEN" ? "bg-green-100 text-green-700" :
                    aiDraftMessage.response_zone === "YELLOW" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {aiDraftMessage.response_zone}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700">{aiDraftMessage.ai_suggestion}</p>
            </div>
            <button
              onClick={() => handleApprove(aiDraftMessage.id)}
              disabled={approving}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {approving ? "Sending..." : "Approve & Send"}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {conversation.messages.map((msg) => {
          const isInbound = msg.direction === "INBOUND";
          return (
            <div
              key={msg.id}
              className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[70%] flex ${isInbound ? "flex-row" : "flex-row-reverse"} items-end gap-2`}>
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                  isInbound ? "bg-gray-100" : "bg-violet-100"
                }`}>
                  {isInbound ? (
                    conversation.contact.profileImageUrl ? (
                      <img src={conversation.contact.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    )
                  ) : (
                    <Send className="w-3.5 h-3.5 text-violet-600" />
                  )}
                </div>
                <div>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                    isInbound
                      ? "bg-gray-100 text-gray-900 rounded-bl-md"
                      : "bg-violet-600 text-white rounded-br-md"
                  }`}>
                    {msg.content ?? "(media/attachment)"}
                  </div>
                  <div className={`flex items-center gap-1.5 mt-1 ${isInbound ? "flex-row" : "flex-row-reverse"}`}>
                    <span className="text-xs text-gray-400">
                      {format(new Date(msg.createdAt), "HH:mm")}
                    </span>
                    {msg.status === "AI_DRAFT" && (
                      <span className="flex items-center gap-1 text-xs text-violet-500">
                        <Bot className="w-3 h-3" />
                        AI draft
                      </span>
                    )}
                    {msg.status === "FAILED" && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply composer */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-end gap-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a reply... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
