"use client";

import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
