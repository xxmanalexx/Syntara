"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, TrendingUp, DollarSign } from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
}

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  estimated_value: number | null;
  currency: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { displayName: string | null; username: string | null; profileImageUrl: string | null };
  assignedTo?: { id: string; user: { name: string | null; email: string } } | null;
  pipelineStage?: { id: string; name: string; color: string } | null;
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchLeads(), fetchPipeline()]);
  }, []);

  async function fetchLeads() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/leads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads ?? []);
      }
    } catch (err) {
      console.error("[LeadsPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPipeline() {
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
      console.error("[LeadsPage] pipeline error:", err);
    }
  }

  function getLeadsForStage(stageId: string) {
    return leads.filter((l) => l.pipelineStage?.id === stageId && !["WON", "LOST"].includes(l.status));
  }

  function getContactName(lead: Lead) {
    return lead.first_name || lead.contact.displayName || lead.contact.username || "Unknown";
  }

  function formatValue(value: number | null, currency: string) {
    if (value == null) return null;
    return `${currency} ${value.toLocaleString()}`;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
            <p className="text-sm text-gray-500">{leads.length} total leads</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/leads/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* Kanban board */}
      {stages.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No pipeline stages</p>
          <p className="text-sm text-gray-400 mt-1">Pipeline stages will appear once created</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
          {stages.map((stage) => {
            const stageLeads = getLeadsForStage(stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-semibold text-gray-700">{stage.name}</span>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {stageLeads.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-4 text-center">
                      <p className="text-xs text-gray-400">No leads</p>
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 hover:border-violet-200 hover:shadow-sm transition"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-bold">
                            {(lead.first_name?.[0] || lead.contact.displayName?.[0] || "?").toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 truncate">
                            {getContactName(lead)}
                          </span>
                        </div>

                        {lead.estimated_value != null && (
                          <div className="flex items-center gap-1 mb-2">
                            <DollarSign className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-sm text-green-700 font-medium">
                              {formatValue(lead.estimated_value, lead.currency)}
                            </span>
                          </div>
                        )}

                        {lead.source && (
                          <p className="text-xs text-gray-400 mb-2">{lead.source.replace(/_/g, " ")}</p>
                        )}

                        <div className="flex items-center justify-between">
                          {lead.assignedTo && (
                            <span className="text-xs text-gray-400 truncate max-w-[100px]">
                              {lead.assignedTo.user.name ?? lead.assignedTo.user.email}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                            lead.status === "NEW_INQUIRY" ? "bg-blue-50 text-blue-600" :
                            lead.status === "QUALIFYING" ? "bg-purple-50 text-purple-600" :
                            lead.status === "OFFER_SENT" ? "bg-yellow-50 text-yellow-600" :
                            lead.status === "FOLLOW_UP_PENDING" ? "bg-orange-50 text-orange-600" :
                            "bg-green-50 text-green-600"
                          }`}>
                            {lead.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
