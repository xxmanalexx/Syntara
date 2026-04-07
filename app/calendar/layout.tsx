import { Sidebar } from "@/components/layout/Sidebar";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
