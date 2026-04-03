import { Sidebar } from "@/components/layout/Sidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
