import { Sidebar } from "@/components/layout/Sidebar";

export default function RepliesLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
