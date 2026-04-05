"use client";

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
  Instagram,
  Activity,
  Inbox,
  Users,
} from "lucide-react";

const CRM_NAV = [
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/leads", icon: Users, label: "Leads" },
];

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/create", icon: PlusCircle, label: "Create" },
  { href: "/brands", icon: FileText, label: "Brands" },
  { href: "/drafts", icon: FileText, label: "Drafts" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export { CRM_NAV, NAV };
