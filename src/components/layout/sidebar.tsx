"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  CheckSquare,
  Users,
  Contact,
  Building2,
  Handshake,
  Search,
  StickyNote,
  FolderOpen,
  FileOutput,
  Receipt,
  Settings,
  Share2,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { useClient } from "@/lib/client-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/config";
import { ClientSwitcher } from "./client-switcher";

interface CrmCustomerItem {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const CRM_EXPANDED_KEY = "fb_crm_expanded";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/timesheet", label: "Timesheet", icon: Clock },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Users },
];

const secondaryNavItemsAfterCrm = [
  { href: "/engagement", label: "Engagement", icon: Handshake },
  { href: "/research", label: "Research", icon: Search },
  { href: "/notes", label: "Notes", icon: StickyNote },
];

const tertiaryNavItems = [
  { href: "/assets", label: "Assets", icon: FolderOpen },
  { href: "/deliverables", label: "Deliverables", icon: FileOutput },
  { href: "/invoicing", label: "Invoicing", icon: Receipt },
];

const bottomNavItems = [
  { href: "/portal?preview=true", label: "Shared with Client", icon: Share2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { isOpen, isMobile, toggle, close } = useSidebar();
  const pathname = usePathname();
  const { clientId, clients } = useClient();

  const [crmExpanded, setCrmExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(CRM_EXPANDED_KEY) === "true";
  });
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomerItem[]>([]);

  const toggleCrmExpanded = useCallback(() => {
    setCrmExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(CRM_EXPANDED_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!clientId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCrmCustomers([]);
      return;
    }
    fetch(`/api/crm-customers?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data) => setCrmCustomers(data))
      .catch(() => setCrmCustomers([]));
  }, [clientId]);

  const activeClient = clients.find((c) => c.id === clientId);
  const contactsLabel = activeClient
    ? `${activeClient.name} Contacts`
    : "Contacts";

  function renderNavItems(items: typeof mainNavItems, ariaLabel: string) {
    return (
      <nav className="space-y-1 px-2 py-2" aria-label={ariaLabel}>
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isMobile ? close : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
              )}
              title={!isOpen ? item.label : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              {isOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    );
  }

  function renderCrmSection() {
    const isCrmActive = pathname === "/crm" || pathname.startsWith("/crm/");

    // Collapsed sidebar: just render a simple link
    if (!isOpen) {
      return (
        <Link
          href="/crm"
          onClick={isMobile ? close : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isCrmActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
          )}
          title="CRM"
        >
          <Building2 className="size-5 shrink-0" />
        </Link>
      );
    }

    return (
      <div>
        <button
          onClick={toggleCrmExpanded}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isCrmActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
          )}
        >
          <Building2 className="size-5 shrink-0" />
          <span className="flex-1 text-left">CRM</span>
          {crmExpanded ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
        </button>
        {crmExpanded && (
          <div className="ml-4 space-y-0.5 py-1">
            {crmCustomers.map((customer) => {
              const customerPath = `/crm/${customer.slug}`;
              const isCustomerActive = pathname === customerPath;
              return (
                <Link
                  key={customer.id}
                  href={customerPath}
                  onClick={isMobile ? close : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isCustomerActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      isCustomerActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{customer.name}</span>
                </Link>
              );
            })}
            <Link
              href="/crm"
              onClick={isMobile ? close : undefined}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="ml-5">View all &rarr;</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  function renderSecondaryNav() {
    return (
      <nav className="space-y-1 px-2 py-2" aria-label="Secondary navigation">
        {/* Contacts with dynamic label */}
        <Link
          href="/contacts"
          onClick={isMobile ? close : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/contacts" || pathname.startsWith("/contacts/")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
          )}
          title={!isOpen ? contactsLabel : contactsLabel}
        >
          <Contact className="size-5 shrink-0" />
          {isOpen && <span className="truncate">{contactsLabel}</span>}
        </Link>

        {/* Expandable CRM */}
        {renderCrmSection()}

        {/* Remaining secondary items */}
        {secondaryNavItemsAfterCrm.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isMobile ? close : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
              )}
              title={!isOpen ? item.label : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              {isOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-4">
        {isOpen && (
          <Link href="/dashboard" className="text-lg font-bold text-gradient">
            FractionalBuddy
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="size-8"
        >
          {isOpen ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeft className="size-4" />
          )}
        </Button>
      </div>

      <Separator />

      <ClientSwitcher />

      <Separator />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {renderNavItems(mainNavItems, "Main navigation")}
        <Separator className="mx-2" />
        {renderSecondaryNav()}
        <Separator className="mx-2" />
        {renderNavItems(tertiaryNavItems, "Tertiary navigation")}
      </div>

      <Separator />
      {renderNavItems(bottomNavItems, "Portal navigation")}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="sticky top-0 h-screen shrink-0 border-r bg-sidebar transition-[width] duration-200"
      style={{ width: isOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
    >
      {sidebarContent}
    </aside>
  );
}
