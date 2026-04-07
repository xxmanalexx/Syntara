import { Sidebar } from "@/components/layout/Sidebar";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
