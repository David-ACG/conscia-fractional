"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  Users,
  FileOutput,
  Receipt,
  StickyNote,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const moduleNavItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, always: true },
  {
    href: "/portal/timesheet",
    label: "Timesheet",
    icon: Clock,
    module: "timesheet",
  },
  { href: "/portal/tasks", label: "Tasks", icon: CheckSquare, module: "tasks" },
  {
    href: "/portal/meetings",
    label: "Meetings",
    icon: Users,
    module: "meetings",
  },
  {
    href: "/portal/deliverables",
    label: "Deliverables",
    icon: FileOutput,
    module: "deliverables",
  },
  {
    href: "/portal/invoicing",
    label: "Invoicing",
    icon: Receipt,
    module: "invoicing",
  },
  { href: "/portal/notes", label: "Notes", icon: StickyNote, module: "notes" },
  {
    href: "/portal/research",
    label: "Research",
    icon: Search,
    module: "research",
  },
] as const;

interface PortalSidebarProps {
  enabledModules: string[];
}

export function PortalSidebar({ enabledModules }: PortalSidebarProps) {
  const pathname = usePathname();

  const visibleItems = moduleNavItems.filter(
    (item) =>
      item.always ||
      ("module" in item && enabledModules.includes(item.module!)),
  );

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r bg-sidebar md:block">
      <nav className="space-y-1 px-3 py-4" aria-label="Portal navigation">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/portal"
              ? pathname === "/portal"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
