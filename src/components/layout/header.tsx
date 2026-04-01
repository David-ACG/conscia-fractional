"use client";

import { Menu, LogOut, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useSidebar } from "@/hooks/use-sidebar";
import { useClient } from "@/lib/client-context";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardHeaderProps {
  userName?: string | null;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
}

export function DashboardHeader({
  userName,
  userEmail,
  userAvatarUrl,
}: DashboardHeaderProps) {
  const { isMobile, open: openSidebar } = useSidebar();
  const { clients, clientId } = useClient();
  const activeClient = clients.find((c) => c.id === clientId);

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  async function handleSignOut() {
    // Will be wired to Supabase signOut when auth is configured
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
      window.location.href = "/auth/login";
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-lg md:px-6">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={openSidebar}
          aria-label="Open navigation"
          className="size-8"
        >
          <Menu className="size-5" />
        </Button>
      )}

      <BreadcrumbNav />

      {activeClient && (
        <Badge
          variant="outline"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1"
        >
          <Building2 className="h-3 w-3" />
          {activeClient.name}
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <Avatar className="size-8">
                {userAvatarUrl && (
                  <AvatarImage src={userAvatarUrl} alt={userName ?? "User"} />
                )}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName ?? "User"}</p>
              {userEmail && (
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/dashboard" className="cursor-pointer">
                <User className="mr-2 size-4" />
                Dashboard
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
