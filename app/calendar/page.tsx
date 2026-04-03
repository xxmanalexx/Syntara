"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, X } from "lucide-react";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "bg-green-500",
  FAILED: "bg-red-500",
  SCHEDULED: "bg-amber-500",
};

const TYPE_ABBREV: Record<string, string> = {
  FEED_POST: "Post",
  CAROUSEL: "Carousel",
  REEL: "Reel",
  STORY: "Story",
};

export default function CalendarPage() {
  const TODAY = new Date();
  const [current, setCurrent] = useState(new Date(TODAY));
  const [selected, setSelected] = useState<Date | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDraftId, setScheduleDraftId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [scheduling, setScheduling] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  // Cancel modal state
  const [cancelModal, setCancelModal] = useState<any | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const loadScheduled = useCallback(async () => {
    const token = localStorage.getItem("syntara_token");
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules?workspaceId=all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledPosts(data.posts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  useEffect(() => {
    if (showScheduleModal) {
      setDraftLoading(true);
      setScheduleDraftId("");
      const token = localStorage.getItem("syntara_token");
      fetch("/api/drafts", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setDrafts(d.drafts ?? []))
        .catch(() => {})
        .finally(() => setDraftLoading(false));
    }
  }, [showScheduleModal]);

  // Filter: only drafts that are not published and have images
  const schedulableDrafts = drafts.filter((d) => d.status !== "PUBLISHED");
  const selectedDraft = schedulableDrafts.find((d) => d.id === scheduleDraftId);
  const selectedEvents = selected
    ? scheduledPosts.filter((e) => isSameDay(new Date(e.scheduledAt), selected))
    : [];

  // All posts visible in current month view (including published)
  const monthPosts = scheduledPosts.filter((e) => {
    const d = new Date(e.scheduledAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  async function handleSchedule() {
    if (!scheduleDraftId) { alert("Please choose a draft"); return; }
    if (!selectedDraft?.hasImage) { alert("This draft has no images attached. Please add an image before scheduling."); return; }
    if (!scheduleDate) { alert("Please select a date"); return; }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) { alert("Invalid or past date/time"); return; }
    setScheduling(true);
    const token = localStorage.getItem("syntara_token");
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ draftId: scheduleDraftId, scheduledAt: scheduledAt.toISOString() }),
    });
    setScheduling(false);
    if (!res.ok) { const d = await res.json(); alert(d.error ?? "Failed to schedule"); return; }
    setShowScheduleModal(false);
    setScheduleDraftId(""); setScheduleDate(""); setScheduleTime("12:00");
    loadScheduled();
  }

  async function handleCancel(postId: string) {
    setCancelling(true);
    const token = localStorage.getItem("syntara_token");
    try {
      const res = await fetch(`/api/schedules/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "Failed to cancel");
      } else {
        setCancelModal(null);
        loadScheduled();
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 mt-1">
            {scheduledPosts.filter((p) => p.publishStatus === "PUBLISHED").length} published &nbsp;·&nbsp;
            {scheduledPosts.filter((p) => p.publishStatus === "SCHEDULED").length} scheduled &nbsp;·&nbsp;
            {scheduledPosts.filter((p) => p.publishStatus === "FAILED").length} failed
          </p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
        >
          <Plus className="w-5 h-5" />
          Schedule Post
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {current.toLocaleString("default", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-28 border-b border-r border-gray-100 bg-gray-50/50" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(year, month, i + 1);
            const dayPosts = scheduledPosts.filter((e) => isSameDay(new Date(e.scheduledAt), date));
            const isToday = isSameDay(date, TODAY);
            const isSelected = selected && isSameDay(date, selected);

            return (
              <div
                key={i}
                onClick={() => setSelected(date)}
                className={`min-h-28 border-b border-r border-gray-100 p-2 cursor-pointer hover:bg-violet-50/30 transition ${isToday ? "bg-violet-50/50" : ""}`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isToday ? "bg-violet-600 text-white" : isSelected ? "bg-violet-100 text-violet-700" : "text-gray-700"}`}>
                  {i + 1}
                </span>
                <div className="mt-1 space-y-1">
                  {dayPosts.slice(0, 3).map((e, j) => (
                    <div
                      key={j}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white ${STATUS_COLORS[e.publishStatus ?? "SCHEDULED"]}`}
                    >
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate flex-1">
                        {new Date(e.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {TYPE_ABBREV[e.draft?.contentType] ?? e.draft?.contentType?.replace("_", " ") ?? "Post"}
                      </span>
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayPosts.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-center text-sm text-gray-400">Loading schedule...</p>}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Schedule a Post</h3>
              <button
                onClick={() => { setShowScheduleModal(false); setScheduleDraftId(""); setScheduleDate(""); setScheduleTime("12:00"); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-500">Select a draft to schedule for a future date.</p>

            {/* Draft select */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Draft</label>
              {draftLoading ? (
                <p className="text-sm text-gray-400 py-2">Loading drafts...</p>
              ) : schedulableDrafts.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No drafts available. Create a draft first.</p>
              ) : (
                <select
                  value={scheduleDraftId}
                  onChange={(e) => setScheduleDraftId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                >
                  <option value="">— Choose a draft —</option>
                  {schedulableDrafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.brand?.name ?? "Brand"} — {TYPE_ABBREV[d.contentType] ?? d.contentType} {d.hasImage ? "" : "⚠️ (no image)"}
                    </option>
                  ))}
                </select>
              )}
              {scheduleDraftId && selectedDraft && !selectedDraft.hasImage && (
                <p className="mt-1.5 text-xs text-amber-600">⚠️ This draft has no images — add one before scheduling.</p>
              )}
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowScheduleModal(false); setScheduleDraftId(""); setScheduleDate(""); setScheduleTime("12:00"); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={scheduling || !scheduleDraftId || !scheduleDate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
              >
                {scheduling ? "Scheduling..." : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Scheduled Post?</h3>
              <button onClick={() => setCancelModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500">
              This will permanently remove the scheduled post for{" "}
              <strong>{TYPE_ABBREV[cancelModal.draft?.contentType] ?? cancelModal.draft?.contentType?.replace("_", " ")}</strong>{" "}
              at{" "}
              <strong>{new Date(cancelModal.scheduledAt).toLocaleString()}</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
              >
                Keep
              </button>
              <button
                onClick={() => handleCancel(cancelModal.id)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected day detail */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No posts scheduled for this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[e.publishStatus ?? "SCHEDULED"]}`} />
                  {/* Time + type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {new Date(e.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {TYPE_ABBREV[e.draft?.contentType] ?? e.draft?.contentType?.replace("_", " ")}
                      </span>
                      {e.draft?.brand?.name && (
                        <span className="text-xs text-gray-400">{e.draft.brand.name}</span>
                      )}
                    </div>
                    {e.lastError && (
                      <p className="text-xs text-red-500 mt-0.5">{e.lastError}</p>
                    )}
                  </div>
                  {/* Status badge */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    e.publishStatus === "PUBLISHED" ? "bg-green-100 text-green-700" :
                    e.publishStatus === "FAILED" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {e.publishStatus}
                  </span>
                  {/* Cancel button — only for SCHEDULED posts */}
                  {e.publishStatus === "SCHEDULED" && (
                    <button
                      onClick={() => setCancelModal(e)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Cancel scheduled post"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
