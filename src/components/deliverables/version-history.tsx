"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getVersionHistory } from "@/lib/actions/deliverables";
import type { DeliverableVersion } from "@/lib/types";

interface VersionHistoryProps {
  deliverableId: string;
  deliverableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistory({
  deliverableId,
  deliverableName,
  open,
  onOpenChange,
}: VersionHistoryProps) {
  const [versions, setVersions] = React.useState<DeliverableVersion[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      getVersionHistory(deliverableId).then((data) => {
        setVersions(data);
        setLoading(false);
      });
    }
  }, [open, deliverableId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>{deliverableName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No version history found.
            </p>
          ) : (
            versions.map((v, i) => (
              <div key={v.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">v{v.version}</Badge>
                  {i === versions.length - 1 && (
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      Initial
                    </Badge>
                  )}
                </div>

                {v.notes && (
                  <p className="text-sm text-muted-foreground">{v.notes}</p>
                )}

                {v.file_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(v.file_url!, "_blank", "noopener,noreferrer")
                    }
                  >
                    <ExternalLink className="mr-1.5 h-3 w-3" />
                    {v.file_name || "Open File"}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
