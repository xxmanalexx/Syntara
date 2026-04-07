import { Sidebar } from "@/components/layout/Sidebar";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
