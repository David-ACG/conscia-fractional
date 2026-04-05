"use client";

import * as React from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetCard } from "./asset-card";
import { AssetForm } from "./asset-form";
import type { Asset, CrmCustomer } from "@/lib/types";

const assetTypeConfig: Record<
  string,
  { label: string; className: string; activeClassName: string }
> = {
  template: {
    label: "Template",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50",
    activeClassName:
      "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-900",
  },
  diagram: {
    label: "Diagram",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50",
    activeClassName:
      "bg-purple-600 text-white dark:bg-purple-400 dark:text-purple-900",
  },
  document: {
    label: "Document",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50",
    activeClassName:
      "bg-green-600 text-white dark:bg-green-400 dark:text-green-900",
  },
  other: {
    label: "Other",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
    activeClassName:
      "bg-slate-800 text-slate-100 dark:bg-slate-300 dark:text-slate-800",
  },
};

interface AssetListProps {
  assets: Asset[];
  customers?: Pick<CrmCustomer, "id" | "name">[];
}

const NO_CUSTOMER = "__general__";

/**
 * Get the customer name for an asset — uses crm_customer_id if set,
 * falls back to text matching in asset name/description.
 */
function getAssetCustomer(
  asset: Asset,
  customers: Pick<CrmCustomer, "id" | "name">[],
): string {
  // Prefer explicit crm_customer_id link
  if (asset.crm_customer_id) {
    const match = customers.find((c) => c.id === asset.crm_customer_id);
    if (match) return match.name;
  }
  // Fall back to text matching
  const text = `${asset.name} ${asset.description ?? ""}`.toLowerCase();
  for (const c of customers) {
    if (text.includes(c.name.toLowerCase())) {
      return c.name;
    }
  }
  return NO_CUSTOMER;
}

export function AssetList({ assets, customers = [] }: AssetListProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [customerFilter, setCustomerFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingAsset, setEditingAsset] = React.useState<Asset | null>(null);

  // Build customer tags for each asset
  const assetCustomerMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      map.set(a.id, getAssetCustomer(a, customers));
    }
    return map;
  }, [assets, customers]);

  // All CRM customers + "General" for unlinked assets
  const customerOptions = React.useMemo(() => {
    const names = customers.map((c) => c.name).sort();
    const hasGeneral = Array.from(assetCustomerMap.values()).some(
      (v) => v === NO_CUSTOMER,
    );
    if (hasGeneral) names.push(NO_CUSTOMER);
    return names;
  }, [customers, assetCustomerMap]);

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      template: 0,
      diagram: 0,
      document: 0,
      other: 0,
    };
    for (const a of assets) {
      counts[a.asset_type] = (counts[a.asset_type] ?? 0) + 1;
    }
    return counts;
  }, [assets]);

  const filtered = React.useMemo(() => {
    let result = assets;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)),
      );
    }
    if (typeFilter !== "all") {
      result = result.filter((a) => a.asset_type === typeFilter);
    }
    if (customerFilter !== "all") {
      result = result.filter(
        (a) => assetCustomerMap.get(a.id) === customerFilter,
      );
    }
    return result;
  }, [assets, search, typeFilter, customerFilter, assetCustomerMap]);

  function handleEdit(asset: Asset) {
    setEditingAsset(asset);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingAsset(null);
  }

  function toggleTypeFilter(type: string) {
    setTypeFilter((prev) => (prev === type ? "all" : type));
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="pl-9"
          />
        </div>

        {/* Customer filter badges */}
        {customerOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCustomerFilter("all")}
              className="inline-flex items-center"
            >
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors ${
                  customerFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All ({assets.length})
              </Badge>
            </button>
            {customerOptions.map((name) => {
              const count = assets.filter(
                (a) => assetCustomerMap.get(a.id) === name,
              ).length;
              const displayName = name === NO_CUSTOMER ? "General" : name;
              return (
                <button
                  key={name}
                  onClick={() =>
                    setCustomerFilter((prev) => (prev === name ? "all" : name))
                  }
                  className="inline-flex items-center"
                >
                  <Badge
                    variant="secondary"
                    className={`cursor-pointer transition-colors ${
                      customerFilter === name
                        ? "bg-primary text-primary-foreground"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                    }`}
                  >
                    {displayName} ({count})
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {(
            Object.entries(assetTypeConfig) as [
              string,
              (typeof assetTypeConfig)[string],
            ][]
          ).map(([type, config]) => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className="inline-flex items-center"
            >
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors ${
                  typeFilter === type
                    ? config.activeClassName
                    : config.className
                }`}
              >
                {config.label} ({typeCounts[type] ?? 0})
              </Badge>
            </button>
          ))}
        </div>

        <Button
          onClick={() => {
            setEditingAsset(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || typeFilter !== "all" || customerFilter !== "all"
              ? "No assets match your filters."
              : "No assets yet. Add templates, diagrams, and documents you use."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={handleEdit}
              customerTag={
                assetCustomerMap.get(asset.id) === NO_CUSTOMER
                  ? undefined
                  : assetCustomerMap.get(asset.id)
              }
            />
          ))}
        </div>
      )}

      <AssetForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        asset={editingAsset}
        customers={customers}
      />
    </>
  );
}
