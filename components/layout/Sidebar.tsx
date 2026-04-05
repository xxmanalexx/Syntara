"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Calendar,
  BarChart3,
  Settings,
  X,
  Instagram,
  Activity,
  Inbox,
  Users,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/create", icon: PlusCircle, label: "Create" },
  { href: "/brands", icon: FileText, label: "Brands" },
  { href: "/drafts", icon: FileText, label: "Drafts" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const CRM_NAV = [
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/leads", icon: Users, label: "Leads" },
];

function CrontStatusDot({ running }: { running: boolean }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full",
      running ? "bg-green-500 animate-pulse" : "bg-gray-300"
    )} />
  );
}

export function Sidebar({ children, title, subtitle }: { children?: React.ReactNode; title?: string; subtitle?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [today, setToday] = useState("");
  const [cronRunning, setCronRunning] = useState(false);
  const [cronLogs, setCronLogs] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const update = () => setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchCronStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/status", { headers: { Authorization: `Bearer ${localStorage.getItem("syntara_token") ?? ""}` } });
      if (res.ok) {
        const data = await res.json();
        setCronRunning(data.running);
        if (data.recentLogs?.length) setCronLogs(data.recentLogs);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchCronStatus(); }, [fetchCronStatus]);

  // Launch cron worker via API
  async function handleLaunchCron() {
    setLaunching(true);
    try {
      const res = await fetch("/api/cron/launch", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("syntara_token") ?? ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCronRunning(true);
        setCronLogs((prev) => [`[${new Date().toLocaleTimeString()}] Launched — PID ${data.pid}`, ...prev.slice(0, 9)]);
      } else {
        alert(data.error ?? "Failed to launch");
      }
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:translate-x-0 lg:static lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Syntara</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}

          {CRM_NAV.length > 0 && (
            <div className="pt-3 mt-3 border-t border-gray-100">
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">CRM</p>
              {CRM_NAV.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                      active
                        ? "bg-violet-50 text-violet-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}


          {/* Cron Job Section */}
          <div className="pt-3 mt-3 border-t border-gray-100">
            <p className="flex items-center gap-2 px-3 py-2 w-full text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <Activity className="w-4 h-4" />
              Background Jobs
              <CrontStatusDot running={cronRunning} />
            </p>

            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                <span className="text-xs text-gray-400">Publish Worker</span>
                <span className="ml-auto text-xs text-gray-400">{cronRunning ? "Running" : "Stopped"}</span>
              </div>
              <button
                onClick={handleLaunchCron}
                disabled={launching || cronRunning}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {launching ? "Launching..." : "Launch Cron Worker"}
              </button>
              {cronLogs.length > 0 && (
                <div className="px-3 py-2 bg-gray-900 rounded-lg mx-1">
                  <p className="text-xs text-gray-400 mb-1 font-semibold">Recent logs</p>
                  {cronLogs.slice(0, 5).map((log, i) => (
                    <p key={i} className="text-xs text-gray-300 font-mono">{log}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Abdalla</p>
              <p className="text-xs text-gray-500 truncate">Pro Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-8 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            {title && (
              <div>
                <h1 className="text-base font-semibold text-gray-900">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-gray-500">{today}</div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-100">
              <CrontStatusDot running={cronRunning} />
              <span className="text-xs text-gray-400">{cronRunning ? "Cron active" : "Cron stopped"}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
