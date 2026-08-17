import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
