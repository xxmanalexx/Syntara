"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Don't wrap /leads/analytics here — it has its own layout
  if (pathname.startsWith("/leads/analytics")) {
    return <>{children}</>;
  }
  return <Sidebar>{children}</Sidebar>;
}
