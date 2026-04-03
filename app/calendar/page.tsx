"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
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

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  useEffect(() => {
    if (showScheduleModal && drafts.length === 0) {
      const token = localStorage.getItem("syntara_token");
      fetch("/api/drafts", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setDrafts(d.drafts ?? []))
        .catch(() => {});
    }
  }, [showScheduleModal, drafts.length]);

  const selectedEvents = selected
    ? scheduledPosts.filter((e) => isSameDay(new Date(e.scheduledAt), selected))
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 mt-1">Plan and schedule your Instagram content.</p>
        </div>
          <button onClick={() => setShowScheduleModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
          <Plus className="w-5 h-5" />
          Schedule Post
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
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

        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 border-b border-r border-gray-100 bg-gray-50/50" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(year, month, i + 1);
            const dayEvents = scheduledPosts.filter((e) => isSameDay(new Date(e.scheduledAt), date));
            const isToday = isSameDay(date, TODAY);
            const isSelected = selected && isSameDay(date, selected);

            return (
              <div
                key={i}
                onClick={() => setSelected(date)}
                className={`min-h-24 border-b border-r border-gray-100 p-2 cursor-pointer hover:bg-violet-50/30 transition ${isToday ? "bg-violet-50/50" : ""}`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isToday ? "bg-violet-600 text-white" : isSelected ? "bg-violet-100 text-violet-700" : "text-gray-700"}`}>
                  {i + 1}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 2).map((e, j) => (
                    <div key={j} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white ${COLOR_MAP[e.color ?? "violet"]}`}>
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {new Date(e.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.draft?.contentType?.replace("_", " ") ?? "POST"}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayEvents.length - 2} more</p>
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
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500">Select a draft to schedule for this date.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Draft</label>
              <select
                value={scheduleDraftId}
                onChange={(e) => setScheduleDraftId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              >
                <option value="">— Choose a draft —</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>{d.brand?.name ?? "Draft"} — {d.contentType.replace("_", " ")}</option>
                ))}
              </select>
            </div>
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
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!scheduleDraftId) { alert("Please choose a draft"); return; }
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
                }}
                disabled={scheduling}
                className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
              >
                {scheduling ? "Scheduling..." : "Schedule"}
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
                  <div className={`w-2 h-2 rounded-full ${COLOR_MAP[e.color ?? "violet"]}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {new Date(e.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-sm text-gray-500">{e.draft?.brand?.name ?? "—"}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {e.draft?.contentType?.replace("_", " ") ?? "POST"}
                  </span>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                    e.publishStatus === "PUBLISHED" ? "bg-green-100 text-green-700" :
                    e.publishStatus === "FAILED" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {e.publishStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
