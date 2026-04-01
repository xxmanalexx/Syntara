"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";

const TODAY = new Date(2026, 3, 1); // April 1, 2026
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MOCK_EVENTS = [
  { date: new Date(2026, 3, 2), time: "10:00", brand: "Glow Botanicals", type: "FEED_POST", color: "violet" },
  { date: new Date(2026, 3, 3), time: "14:00", brand: "Glow Botanicals", type: "REEL", color: "purple" },
  { date: new Date(2026, 3, 5), time: "09:00", brand: "Glow Botanicals", type: "CAROUSEL", color: "pink" },
  { date: new Date(2026, 3, 8), time: "11:00", brand: "Glow Botanicals", type: "STORY", color: "amber" },
  { date: new Date(2026, 3, 12), time: "10:00", brand: "Glow Botanicals", type: "FEED_POST", color: "violet" },
];

const COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date(TODAY));
  const [selected, setSelected] = useState<Date | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const events = MOCK_EVENTS.filter((e) => isSameDay(e.date, current));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 mt-1">Plan and schedule your Instagram content.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
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

        <div className="grid grid-cols-7">
          {/* Day labels */}
          {DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              {d}
            </div>
          ))}

          {/* Empty cells */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 border-b border-r border-gray-100 bg-gray-50/50" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(year, month, i + 1);
            const dayEvents = MOCK_EVENTS.filter((e) => isSameDay(e.date, date));
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
                    <div key={j} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white ${COLOR_MAP[e.color]}`}>
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{e.time} · {e.type.replace("_", " ")}</span>
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

      {/* Selected day detail */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400">No posts scheduled for this day.</p>
          ) : (
            <div className="space-y-3">
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                  <div className={`w-2 h-2 rounded-full ${COLOR_MAP[e.color]}`} />
                  <span className="text-sm font-medium text-gray-700">{e.time}</span>
                  <span className="text-sm text-gray-500">{e.brand}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{e.type.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
