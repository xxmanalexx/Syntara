"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    source: "direct",
    estimated_value: "",
    currency: "USD",
    notes: "",
    pipelineStageId: "",
  });

  useEffect(() => {
    fetchStages();
  }, []);

  async function fetchStages() {
    try {
      const token = localStorage.getItem("syntara_token") ?? "";
      const res = await fetch("/api/leads/pipeline", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages ?? []);
        if (data.stages?.length > 0) {
          setForm((f) => ({ ...f, pipelineStageId: data.stages[0].id }));
        }
      }
    } catch (err) {
      console.error("[NewLeadPage] stages error:", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() && !form.email.trim()) return;
    setLoading(true);

    try {
      const token = localStorage.getItem("syntara_token") ?? "";

      // 1. Create a contact first
      const contactRes = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: form.first_name + (form.last_name ? ` ${form.last_name}` : ""),
          email: form.email || undefined,
          phone: form.phone || undefined,
        }),
      });

      let contactId: string;

      if (contactRes.ok) {
        const contactData = await contactRes.json();
        contactId = contactData.contact?.id ?? contactData.id;
      } else {
        // Contact API might not exist — try inbox contact creation
        const altRes = await fetch("/api/inbox/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            displayName: form.first_name + (form.last_name ? ` ${form.last_name}` : ""),
            email: form.email || undefined,
            phone: form.phone || undefined,
            username: form.email || undefined,
          }),
        });
        if (!altRes.ok) {
          // Fallback: use a placeholder contact or skip
          alert("Could not create contact. Please try again.");
          setLoading(false);
          return;
        }
        const altData = await altRes.json();
        contactId = altData.contact?.id ?? altData.id;
      }

      // 2. Create the lead
      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contactId,
          source: form.source,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          company: form.company || undefined,
          estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
          currency: form.currency,
          pipelineStageId: form.pipelineStageId || undefined,
          notes: form.notes || undefined,
        }),
      });

      if (leadRes.ok) {
        const data = await leadRes.json();
        router.push(`/leads/${data.lead.id}`);
      } else {
        const err = await leadRes.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error("[NewLeadPage] submit error:", err);
      alert("Something went wrong. Check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push("/leads")} className="text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Add New Lead</h1>
          <p className="text-sm text-gray-500">Create a lead and add it to your pipeline</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name *</label>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
              placeholder="Abdalla"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="Ahmed"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="abdalla@company.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+966 50 123 4567"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
        </div>

        {/* Company + Source */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Company</label>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Acme Corp"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            >
              <option value="direct">Direct</option>
              <option value="instagram_dm">Instagram DM</option>
              <option value="instagram_comment">Instagram Comment</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="cold_outreach">Cold Outreach</option>
            </select>
          </div>
        </div>

        {/* Value + Stage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Estimated Value</label>
            <input
              type="number"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
              placeholder="5000"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            >
              <option value="USD">USD</option>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        {/* Pipeline Stage */}
        {stages.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Pipeline Stage</label>
            <select
              value={form.pipelineStageId}
              onChange={(e) => setForm({ ...form, pipelineStageId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="Any context about this lead..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || (!form.first_name.trim() && !form.email.trim())}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? "Creating..." : "Create Lead"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/leads")}
            className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
