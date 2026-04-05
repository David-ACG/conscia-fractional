"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface PortalHeaderProps {
  clientName: string;
}

export function PortalHeader({ clientName }: PortalHeaderProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.href = "/portal/login";
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-lg md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-gradient">FractionalBuddy</span>
        <span className="text-sm text-muted-foreground hidden sm:inline">
          Client Portal
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm font-medium hidden sm:inline">
          {clientName}
        </span>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-muted-foreground hover:text-destructive"
        >
          {signingOut ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          Sign out
        </Button>
      </div>
    </header>
  );
}
