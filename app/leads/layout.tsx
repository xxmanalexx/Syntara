import { Sidebar } from "@/components/layout/Sidebar";
import { Inbox, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CRM_NAV_ITEMS = [
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/leads", icon: Users, label: "Leads" },
];

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Sidebar>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Manage leads and pipeline</p>
      </div>
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        {CRM_NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>
      {children}
    </Sidebar>
  );
}
