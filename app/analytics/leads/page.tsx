"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  TrendingDown,
  UserPlus,
  AlertCircle,
} from "lucide-react";

interface Stat {
  newLeadsToday: number;
  openConversations: number;
  leadsThisMonth: number;
  wonThisMonth: number;
  lostThisMonth: number;
  followUpsDueToday: number;
  avgFirstResponseHours: number | null;
}

interface PipelineFunnelItem {
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
  pipelineStage?: { name: string; color: string } | null;
  assignedTo?: { user: { name: string | null } } | null;
}

export default function LeadsAnalyticsPage() {
  const [stats, setStats] = useState<Stat | null>(null);
  const [pipelineFunnel, setPipelineFunnel] = useState<PipelineFunnelItem[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/leads/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setPipelineFunnel(data.pipelineFunnel ?? []);
        setRecentLeads(data.recentLeads ?? []);
      }
    } catch (err) {
      console.error("[LeadsAnalytics] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const totalPipelineLeads = pipelineFunnel.reduce((sum, s) => sum + s.count, 0);
  const maxFunnelCount = Math.max(...pipelineFunnel.map((s) => s.count), 1);

  const kpis = [
    {
      label: "New Leads Today",
      value: stats.newLeadsToday,
      icon: UserPlus,
      color: "blue",
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Open Conversations",
      value: stats.openConversations,
      icon: MessageSquare,
      color: "violet",
      bg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      label: "Won This Month",
      value: stats.wonThisMonth,
      icon: TrendingUp,
      color: "green",
      bg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      label: "Lost This Month",
      value: stats.lostThisMonth,
      icon: TrendingDown,
      color: "red",
      bg: "bg-red-50",
      iconColor: "text-red-600",
    },
    {
      label: "Follow-ups Due Today",
      value: stats.followUpsDueToday,
      icon: AlertCircle,
      color: stats.followUpsDueToday > 0 ? "orange" : "gray",
      bg: stats.followUpsDueToday > 0 ? "bg-orange-50" : "bg-gray-50",
      iconColor: stats.followUpsDueToday > 0 ? "text-orange-600" : "text-gray-400",
    },
    {
      label: "Avg First Response",
      value: stats.avgFirstResponseHours != null ? `${stats.avgFirstResponseHours}h` : "—",
      icon: Clock,
      color: "gray",
      bg: "bg-gray-50",
      iconColor: "text-gray-500",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Lead Analytics</h2>
          <p className="text-sm text-gray-500">CRM performance overview</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-4.5 h-4.5 ${kpi.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Pipeline Funnel</h3>
        {pipelineFunnel.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No pipeline data</p>
        ) : (
          <div className="space-y-3">
            {pipelineFunnel.map((stage) => {
              const pct = (stage.count / maxFunnelCount) * 100;
              return (
                <div key={stage.id} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600 font-medium text-right truncate">
                    {stage.name}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center pl-3 transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, stage.count > 0 ? 8 : 0)}%`,
                        backgroundColor: stage.color,
                        minWidth: stage.count > 0 ? "2rem" : "0",
                      }}
                    >
                      {stage.count > 0 && (
                        <span className="text-white text-xs font-bold">{stage.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Leads</h3>
        {recentLeads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No leads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Stage</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium text-right">Value</th>
                  <th className="pb-3 font-medium text-right">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLeads.map((lead) => {
                  const name = lead.first_name || lead.contact.displayName || lead.contact.username || "—";
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="py-3 font-medium text-gray-900">{name}</td>
                      <td className="py-3">
                        {lead.pipelineStage && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: lead.pipelineStage.color + "20",
                              color: lead.pipelineStage.color,
                            }}
                          >
                            {lead.pipelineStage.name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {lead.source ? lead.source.replace(/_/g, " ") : "—"}
                      </td>
                      <td className="py-3 text-right text-gray-700">
                        {lead.estimated_value != null
                          ? `${lead.currency} ${lead.estimated_value.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="py-3 text-right text-gray-400">
                        {format(new Date(lead.createdAt), "MMM d")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
