"use client";

import * as React from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { linkAssetToCustomer } from "@/lib/actions/assets";
import type { Asset } from "@/lib/types";

interface BulkLinkAssetsProps {
  unlinkedAssets: Asset[];
  customerId: string;
  customerName: string;
}

export function BulkLinkAssets({
  unlinkedAssets,
  customerId,
  customerName,
}: BulkLinkAssetsProps) {
  const [linking, setLinking] = React.useState<Record<string, boolean>>({});
  const [linked, setLinked] = React.useState<Set<string>>(new Set());

  if (unlinkedAssets.length === 0) return null;

  const pending = unlinkedAssets.filter((a) => !linked.has(a.id));
  if (pending.length === 0) return null;

  async function handleLink(assetId: string) {
    setLinking((prev) => ({ ...prev, [assetId]: true }));
    const result = await linkAssetToCustomer(assetId, customerId);
    setLinking((prev) => ({ ...prev, [assetId]: false }));

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Asset linked");
      setLinked((prev) => new Set(prev).add(assetId));
    }
  }

  async function handleLinkAll() {
    for (const asset of pending) {
      await handleLink(asset.id);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-amber-500/50 bg-amber-50/50 p-4 dark:bg-amber-950/20">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium">Unlinked Assets</h4>
          <p className="text-xs text-muted-foreground">
            These assets match &ldquo;{customerName}&rdquo; by name but
            aren&apos;t linked yet.
          </p>
        </div>
        {pending.length > 1 && (
          <Button size="sm" variant="outline" onClick={handleLinkAll}>
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Link All ({pending.length})
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {pending.map((asset) => (
          <div
            key={asset.id}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{asset.name}</p>
              {asset.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {asset.description}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={linking[asset.id]}
              onClick={() => handleLink(asset.id)}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {linking[asset.id] ? "Linking..." : `Link to ${customerName}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
