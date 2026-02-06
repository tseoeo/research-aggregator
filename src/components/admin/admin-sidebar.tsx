"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminToken } from "@/lib/admin/use-admin-fetch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Brain,
  ListTodo,
  Database,
  Lock,
  ArrowLeft,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/ai", label: "AI Processing", icon: Brain },
  { href: "/admin/queues", label: "Queues", icon: ListTodo },
  { href: "/admin/ingestion", label: "Ingestion", icon: Database },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { setToken } = useAdminToken();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border/50 bg-muted/30">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border/50 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
          <span className="text-sm font-bold text-primary">R</span>
        </div>
        <span className="text-sm font-semibold tracking-tight">Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 p-3 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to site
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 px-3 text-muted-foreground hover:text-foreground"
          onClick={() => setToken(null)}
        >
          <Lock className="size-4" />
          Lock
        </Button>
      </div>
    </aside>
  );
}
