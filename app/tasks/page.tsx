"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, Plus } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: "FOLLOW_UP" | "CALL" | "QUOTE" | "BOOKING" | "MEETING" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  completedAt: string | null;
  lead?: { id: string; first_name: string | null; last_name: string | null } | null;
}

const PRIORITY_CONFIG = {
  LOW: { label: "Low", color: "text-gray-400", bg: "bg-gray-100" },
  MEDIUM: { label: "Medium", color: "text-blue-600", bg: "bg-blue-100" },
  HIGH: { label: "High", color: "text-orange-600", bg: "bg-orange-100" },
  URGENT: { label: "Urgent", color: "text-red-600", bg: "bg-red-100" },
};

const TYPE_CONFIG = {
  FOLLOW_UP: { label: "Follow-up", icon: "🔁" },
  CALL: { label: "Call", icon: "📞" },
  QUOTE: { label: "Quote", icon: "📋" },
  BOOKING: { label: "Booking", icon: "📅" },
  MEETING: { label: "Meeting", icon: "🤝" },
  OTHER: { label: "Other", icon: "📌" },
};

function formatDue(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: "text-red-500", overdue: true };
  if (days === 0) return { label: "Today", color: "text-orange-500", overdue: false };
  if (days === 1) return { label: "Tomorrow", color: "text-yellow-600", overdue: false };
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-gray-500", overdue: false };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: "", description: "", type: "FOLLOW_UP" as Task["type"], priority: "MEDIUM" as Task["priority"], dueDate: "" });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [savedReplies, setSavedReplies] = useState<{ id: string; title: string; content: string }[]>([]);

  useEffect(() => { fetchTasks(); fetchSavedReplies(); }, []);

  async function fetchSavedReplies() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/templates/saved-replies", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSavedReplies((await res.json()).replies ?? []);
    } catch (err) {
      console.error("[TasksPage] fetchSavedReplies", err);
    }
  }

  async function fetchTasks() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTasks((await res.json()).tasks ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openNewModal() {
    setEditingTask(null);
    setForm({ title: "", description: "", type: "FOLLOW_UP", priority: "MEDIUM", dueDate: "" });
    setShowModal(true);
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      type: task.type,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, dueDate: form.dueDate || undefined }),
        });
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, dueDate: form.dueDate || undefined }),
        });
      }
      setShowModal(false);
      setForm({ title: "", description: "", type: "FOLLOW_UP", priority: "MEDIUM", dueDate: "" });
      setEditingTask(null);
      fetchTasks();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      fetchTasks();
    } catch (err) {
      console.error("[handleDelete]", err);
    }
  }

  async function toggleComplete(task: Task) {
    setToggling(task.id);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ completed: !task.completedAt }),
      });
      fetchTasks();
    } finally {
      setToggling(null);
    }
  }

  const incomplete = tasks.filter((t) => !t.completedAt);
  const completed = tasks.filter((t) => t.completedAt);
  const overdue = incomplete.filter((t) => t.dueDate && formatDue(t.dueDate)?.overdue);
  const today = incomplete.filter((t) => t.dueDate && formatDue(t.dueDate)?.label === "Today");
  const upcoming = incomplete.filter((t) => !t.dueDate || (!formatDue(t.dueDate)?.overdue && formatDue(t.dueDate)?.label !== "Today"));

  function TaskCard({ task }: { task: Task }) {
    const due = formatDue(task.dueDate);
    const priority = PRIORITY_CONFIG[task.priority];
    const type = TYPE_CONFIG[task.type];
    const done = !!task.completedAt;

    return (
      <div className={`flex items-start gap-3 p-3.5 rounded-xl border transition group ${done ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-gray-100 hover:border-gray-200"}`}>
        <button
          onClick={() => toggleComplete(task)}
          disabled={toggling === task.id}
          className={`mt-0.5 flex-shrink-0 ${done ? "text-green-500" : "text-gray-300 hover:text-green-500"} transition`}
        >
          {done ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Circle className="w-4.5 h-4.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${done ? "line-through text-gray-400" : "text-gray-800"}`}>{task.title}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => openEditModal(task)}
                  className="text-xs text-gray-400 hover:text-orange-500 px-1 py-0.5 rounded"
                  title="Edit task"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-xs text-gray-400 hover:text-red-500 px-1 py-0.5 rounded"
                  title="Delete task"
                >
                  🗑
                </button>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.color}`}>{priority.label}</span>
            </div>
          </div>
          {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-gray-400">{type.icon} {type.label}</span>
            {task.lead && (
              <span className="text-xs text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                {(task.lead.first_name || "Lead")}
              </span>
            )}
            {due && (
              <span className={`text-xs flex items-center gap-1 ${due.color}`}>
                <Clock className="w-3 h-3" />
                {due.label}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
            <p className="text-sm text-gray-500">{incomplete.length} open · {overdue.length} overdue</p>
          </div>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-500 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Overdue
              </h3>
              <div className="space-y-2">{overdue.map((t) => <TaskCard key={t.id} task={t} />)}</div>
            </div>
          )}
          {today.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Today
              </h3>
              <div className="space-y-2">{today.map((t) => <TaskCard key={t.id} task={t} />)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Upcoming</h3>
              <div className="space-y-2">{upcoming.map((t) => <TaskCard key={t.id} task={t} />)}</div>
            </div>
          )}
          {incomplete.length === 0 && completed.length === 0 && (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tasks yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first task to stay on top of things</p>
            </div>
          )}
          {completed.length > 0 && (
            <details className="group">
              <summary className="text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-600 mb-2">
                Completed ({completed.length})
              </summary>
              <div className="space-y-2 opacity-60">{completed.map((t) => <TaskCard key={t.id} task={t} />)}</div>
            </details>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingTask ? "Edit Task" : "New Task"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                <div className="relative">
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="What needs to be done?" className="w-full px-3 py-2 pr-20 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400" />
                  {!editingTask && (
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const reply = savedReplies.find((r) => r.id === val);
                        if (reply) setForm({ ...form, title: reply.title, description: reply.content });
                        e.target.value = "";
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-transparent border-none cursor-pointer focus:outline-none max-w-[120px]"
                    >
                      <option value="">Pick from saved →</option>
                      {savedReplies.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {form.description && (
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm text-orange-700">
                  <p className="font-medium text-orange-600 mb-1">Content:</p>
                  <p className="whitespace-pre-wrap">{form.description}</p>
                  <button type="button" onClick={() => setForm({ ...form, description: "" })} className="mt-1 text-xs text-orange-400 hover:text-orange-600">Clear</button>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional details..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Task["type"] })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400">
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400">
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50">
                  {saving ? (editingTask ? "Saving..." : "Creating...") : (editingTask ? "Save Changes" : "Create Task")}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
