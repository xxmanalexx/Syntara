"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  User,
  DollarSign,
  Phone,
  Mail,
  Building,
  Tag,
  CheckCircle,
  MessageSquare,
  Activity,
  LayoutGrid,
  CheckSquare,
  Clock,
  Trash2,
  Instagram,
} from "lucide-react";

interface Contact {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  follower_count: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  assignedTo?: { id: string; user: { name: string | null } } | null;
}

interface LeadActivity {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  conversationId: string | null;
}

interface Message {
  id: string;
  direction: string;
  content: string | null;
  createdAt: string;
  status: string;
}

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  estimated_value: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  tasks: Task[];
  activities: LeadActivity[];
  conversation?: { id: string; channel?: string | null; ig_post_caption?: string | null; ig_post_permalink?: string | null } | null;
  assignedTo?: { id: string; user: { name: string | null; email: string } } | null;
  pipelineStage?: { id: string; name: string; color: string } | null;
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
}

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "conversation", label: "Conversation", icon: MessageSquare },
  { key: "activity", label: "Activity", icon: Activity },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [notes, setNotes] = useState("");
  const [allTasks, setAllTasks] = useState<{ id: string; title: string; leadId: string | null }[]>([]);
  const [taskToEdit, setTaskToEdit] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    fetchLead();
    fetchStages();
    fetchAllTasks();
  }, [leadId]);

  async function fetchAllTasks() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/tasks?includeCompleted=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllTasks(data.tasks ?? []);
      }
    } catch (err) {
      console.error("[fetchAllTasks]", err);
    }
  }

  async function fetchLead() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLead(data.lead);
        setNotes(data.lead.notes ?? "");
      }
    } catch (err) {
      console.error("[LeadDetailPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStages() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/leads/pipeline", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages ?? []);
      }
    } catch (err) {
      console.error("[LeadDetailPage] stages error:", err);
    }
  }

  async function handleMoveStage(stageId: string) {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/leads/${leadId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stageId }),
      });
      await fetchLead();
    } catch (err) {
      console.error("[LeadDetailPage] move stage error:", err);
    }
  }

  async function handleMarkWon() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/leads/${leadId}/won`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchLead();
    } catch (err) {
      console.error("[LeadDetailPage] mark won error:", err);
    }
  }

  async function handleMarkLost() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/leads/${leadId}/lost`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchLead();
    } catch (err) {
      console.error("[LeadDetailPage] mark lost error:", err);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId, title: newTaskTitle.trim() }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        await fetchLead();
        await fetchAllTasks();
      }
    } finally {
      setAddingTask(false);
    }
  }

  async function handleLinkTask(taskId: string) {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/tasks/${taskId}/lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId }),
      });
      await fetchLead();
      await fetchAllTasks();
    } catch (err) {
      console.error("[handleLinkTask]", err);
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchLead();
    } catch (err) {
      console.error("[LeadDetailPage] complete task error:", err);
    }
  }

  async function handleSaveNotes() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes }),
      });
    } catch (err) {
      console.error("[LeadDetailPage] save notes error:", err);
    }
  }

  async function handleDeleteLead() {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) router.push("/leads");
    } catch (err) {
      console.error("[LeadDetailPage] delete lead error:", err);
    }
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400">Loading lead...</div>;
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Lead not found</p>
        <button onClick={() => router.push("/leads")} className="mt-4 text-violet-600 hover:underline">
          Back to leads
        </button>
      </div>
    );
  }

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.contact.displayName || lead.contact.username || "Unknown";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/leads")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white font-bold text-lg">
          {fullName[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm text-gray-500">{lead.contact.email ?? lead.email ?? "—"}</span>
            {lead.source && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {lead.source.replace(/_/g, " ")}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              lead.status === "WON" ? "bg-green-100 text-green-700" :
              lead.status === "LOST" ? "bg-red-100 text-red-700" :
              lead.pipelineStage
                ? "text-white"
                : "bg-gray-100 text-gray-600"
            }`} style={lead.pipelineStage ? { backgroundColor: lead.pipelineStage.color + "20", color: lead.pipelineStage.color } : {}}>
              {lead.pipelineStage?.name ?? lead.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stage dropdown */}
          <select
            onChange={(e) => e.target.value && handleMoveStage(e.target.value)}
            value={lead.pipelineStage?.id ?? ""}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {lead.status !== "WON" && (
            <button onClick={handleMarkWon} className="text-sm px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition">
              Mark Won
            </button>
          )}
          {lead.status !== "LOST" && (
            <button onClick={handleMarkLost} className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition">
              Mark Lost
            </button>
          )}
        </div>
        <button
          onClick={handleDeleteLead}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
          title="Delete lead"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      {/* Value */}
      {lead.estimated_value != null && (
        <div className="flex items-center gap-2 mb-6 bg-green-50 border border-green-100 rounded-xl px-4 py-3 w-fit">
          <DollarSign className="w-5 h-5 text-green-600" />
          <span className="text-lg font-bold text-green-700">
            {lead.currency} {lead.estimated_value.toLocaleString()}
          </span>
          <span className="text-sm text-green-600">estimated value</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === key
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact details */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Contact Details</h3>
            <div className="space-y-3">
              {lead.contact.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${lead.contact.email}`} className="text-violet-600 hover:underline">{lead.contact.email}</a>
                </div>
              )}
              {lead.contact.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${lead.contact.phone}`} className="text-violet-600 hover:underline">{lead.contact.phone}</a>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{lead.company}</span>
                </div>
              )}
              {lead.contact.location && (
                <div className="flex items-center gap-3 text-sm">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{lead.contact.location}</span>
                </div>
              )}
              {lead.contact.follower_count > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{lead.contact.follower_count.toLocaleString()} followers</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
              <button onClick={handleSaveNotes} className="text-xs text-violet-600 hover:underline font-medium">
                Save
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-48 resize-none rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              placeholder="Add notes about this lead..."
            />
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Link Task from Tasks</h3>
          <select
            onChange={(e) => {
              const taskId = e.target.value;
              if (!taskId) return;
              handleLinkTask(taskId);
              e.target.value = "";
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 mb-4"
          >
            <option value="">Pick a task to link →</option>
            {allTasks.filter((t) => !t.leadId).map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>

          {lead.tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {lead.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                  <button
                    onClick={() => !task.completedAt && handleCompleteTask(task.id)}
                    disabled={!!task.completedAt}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      task.completedAt ? "bg-green-100 border-green-400" : "border-gray-300 hover:border-violet-400"
                    }`}
                  >
                    {task.completedAt && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                  </button>
                  {taskToEdit === task.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                      />
                      <button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem("syntara_token") ?? "";
                            await fetch(`/api/tasks/${task.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ title: editTitle }),
                            });
                            setTaskToEdit(null);
                            await fetchLead();
                          } catch (err) {
                            console.error("[handleEditTask]", err);
                          }
                        }}
                        className="text-xs text-violet-600 font-medium px-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setTaskToEdit(null)}
                        className="text-xs text-gray-400 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.completedAt ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {task.title}
                      </p>
                      {task.dueDate && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {!taskToEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => { setTaskToEdit(task.id); setEditTitle(task.title); }}
                        className="text-xs text-gray-400 hover:text-violet-600 px-1"
                        title="Edit task"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this task?")) return;
                          try {
                            const token = localStorage.getItem("syntara_token") ?? "";
                            await fetch(`/api/tasks/${task.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                            await fetchLead();
                          } catch (err) {
                            console.error("[handleDeleteTask]", err);
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 px-1"
                        title="Delete task"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    task.priority === "URGENT" ? "bg-red-50 text-red-600" :
                    task.priority === "HIGH" ? "bg-orange-50 text-orange-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "conversation" && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          {lead.conversation ? (
            <div className="space-y-3">
              {lead.conversation.channel === "INSTAGRAM" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-pink-50 border border-pink-100 text-sm">
                  <Instagram className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-pink-700 font-medium">Instagram</p>
                    {lead.conversation.ig_post_caption && (
                      <p className="text-gray-600 mt-1 line-clamp-2">"{lead.conversation.ig_post_caption}"</p>
                    )}
                    {lead.conversation.ig_post_permalink && (
                      <a
                        href={lead.conversation.ig_post_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pink-500 hover:text-pink-700 mt-1 inline-block"
                      >
                        View post →
                      </a>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => router.push(`/inbox/${lead.conversation!.id}`)}
                className="flex items-center gap-2 text-violet-600 hover:underline text-sm font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                Open in Inbox →
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No conversation linked to this lead</p>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          {lead.activities.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4">
                {lead.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 z-10">
                      <Activity className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm text-gray-800">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
