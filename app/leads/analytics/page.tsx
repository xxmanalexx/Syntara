"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Users, MessageSquare, Target, Clock, CheckCircle2 } from "lucide-react";

interface Stat {
  newLeadsToday: number;
  openConversations: number;
  leadsThisMonth: number;
  wonThisMonth: number;
  lostThisMonth: number;
  followUpsDueToday: number;
  avgFirstResponseHours: number | null;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
  count: number;
}

interface RecentLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  source: string | null;
  estimated_value: number | null;
  currency: string;
  createdAt: string;
  contact: { displayName: string | null; username: string | null };
  pipelineStage: { name: string; color: string } | null;
  assignedTo: { user: { name: string | null } } | null;
}

function fmtValue(val: number | null, currency: string) {
  if (val == null) return "—";
  return `${currency} ${val.toLocaleString()}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW_INQUIRY: "bg-blue-50 text-blue-600",
    QUALIFYING: "bg-purple-50 text-purple-600",
    OFFER_SENT: "bg-yellow-50 text-yellow-600",
    FOLLOW_UP_PENDING: "bg-orange-50 text-orange-600",
    READY_TO_BUY: "bg-green-50 text-green-600",
    WON: "bg-green-100 text-green-700",
    LOST: "bg-red-50 text-red-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function LeadsAnalyticsPage() {
  const [stats, setStats] = useState<Stat | null>(null);
  const [funnel, setFunnel] = useState<PipelineStage[]>([]);
  const [recent, setRecent] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/leads/analytics", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setFunnel(data.pipelineFunnel ?? []);
        setRecent(data.recentLeads ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { label: "New Leads Today", value: stats?.newLeadsToday ?? 0, icon: TrendingUp, color: "violet", bg: "bg-violet-50" },
    { label: "Open Conversations", value: stats?.openConversations ?? 0, icon: MessageSquare, color: "pink", bg: "bg-pink-50" },
    { label: "Leads This Month", value: stats?.leadsThisMonth ?? 0, icon: Users, color: "blue", bg: "bg-blue-50" },
    { label: "Won This Month", value: stats?.wonThisMonth ?? 0, icon: CheckCircle2, color: "green", bg: "bg-green-50" },
    { label: "Lost This Month", value: stats?.lostThisMonth ?? 0, icon: Target, color: "red", bg: "bg-red-50" },
    { label: "Follow-ups Due", value: stats?.followUpsDueToday ?? 0, icon: Clock, color: "orange", bg: "bg-orange-50" },
  ];

  const colorMap: Record<string, string> = {
    violet: "text-violet-600", pink: "text-pink-600", blue: "text-blue-600",
    green: "text-green-600", red: "text-red-600", orange: "text-orange-600",
  };
  const bgMap: Record<string, string> = {
    violet: "bg-violet-100", pink: "bg-pink-100", blue: "bg-blue-100",
    green: "bg-green-100", red: "bg-red-100", orange: "bg-orange-100",
  };

  const maxFunnel = Math.max(...funnel.map((s) => s.count), 1);
  const totalLeads = funnel.reduce((sum, s) => sum + s.count, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />)}
        </div>
        <div className="bg-gray-100 rounded-xl h-48 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Lead Analytics</h2>
          <p className="text-sm text-gray-500">
            {stats?.avgFirstResponseHours != null
              ? `Avg. first response: ${stats.avgFirstResponseHours}h`
              : "No response data yet"}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${colorMap[color]}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline funnel */}
      {funnel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Pipeline — {totalLeads} active leads</h3>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex flex-col gap-3">
              {funnel.map((stage) => {
                const pct = Math.round((stage.count / maxFunnel) * 100);
                return (
                  <div key={stage.id} className="flex items-center gap-4">
                    <div className="w-32 text-xs font-medium text-gray-600 truncate">{stage.name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-2 text-white text-xs font-bold"
                        style={{ width: `${Math.max(pct, stage.count > 0 ? 8 : 0)}%`, backgroundColor: stage.color }}
                      >
                        {stage.count > 0 ? stage.count : ""}
                      </div>
                    </div>
                    <div className="w-8 text-xs text-gray-400 text-right">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent leads */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-4">Recent Leads</h3>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {recent.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No leads yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Stage</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Value</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                  <th className="text-left px-4 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((lead) => {
                  const name = lead.first_name || lead.contact.displayName || lead.contact.username || "Unknown";
                  return (
                    <tr key={lead.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(name[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 truncate max-w-[120px]">{name}</p>
                            {lead.assignedTo && (
                              <p className="text-xs text-gray-400 truncate max-w-[100px]">{lead.assignedTo.user.name ?? "Unassigned"}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.pipelineStage && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: lead.pipelineStage.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lead.pipelineStage.color }} />
                            {lead.pipelineStage.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{fmtValue(lead.estimated_value, lead.currency)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{lead.source?.replace(/_/g, " ") ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
