"use client";

import { Eye, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PortalPreviewBanner() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-2 border-b bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <Eye className="size-4" />
        <span>
          Preview Mode — You are viewing the portal as your client sees it
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        onClick={() => router.push("/settings#portal")}
      >
        <X className="size-3" />
        Exit Preview
      </Button>
    </div>
  );
}
