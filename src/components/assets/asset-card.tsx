"use client";

import { FileText, GitBranch, File, Package, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Asset } from "@/lib/types";

const assetTypeConfig: Record<
  string,
  { label: string; className: string; icon: typeof FileText }
> = {
  template: {
    label: "Template",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: FileText,
  },
  diagram: {
    label: "Diagram",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    icon: GitBranch,
  },
  document: {
    label: "Document",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: File,
  },
  other: {
    label: "Other",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    icon: Package,
  },
};

interface AssetCardProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
  customerTag?: string;
}

export function AssetCard({ asset, onClick, customerTag }: AssetCardProps) {
  const typeInfo = assetTypeConfig[asset.asset_type] ?? assetTypeConfig.other;
  const Icon = typeInfo.icon;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onClick(asset)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="font-semibold truncate">{asset.name}</h3>
          </div>
          <Badge
            variant="secondary"
            className={`shrink-0 ${typeInfo.className}`}
          >
            {typeInfo.label}
          </Badge>
        </div>

        {customerTag && (
          <Badge variant="outline" className="mt-2 text-xs">
            {customerTag}
          </Badge>
        )}

        {asset.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {asset.description}
          </p>
        )}

        {asset.file_url && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={(e) => {
              e.stopPropagation();
              window.open(asset.file_url!, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="mr-1.5 h-3 w-3" />
            Open Link
          </Button>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {new Date(asset.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
