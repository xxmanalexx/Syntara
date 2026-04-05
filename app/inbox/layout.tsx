import { Sidebar } from "@/components/layout/Sidebar";
import { CRM_NAV, NAV } from "@/components/layout/sidebar-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, Users } from "lucide-react";

const CRM_NAV_ITEMS = [
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/leads", icon: Users, label: "Leads" },
];

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <Sidebar>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Manage conversations and leads</p>
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
