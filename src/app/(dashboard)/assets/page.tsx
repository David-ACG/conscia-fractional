import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { AssetList } from "@/components/assets/asset-list";
import type { Asset, CrmCustomer } from "@/lib/types";

async function getAssetsData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { assets: [], customers: [] };

  const supabase = createClient();
  if (!supabase) return { assets: [], customers: [] };

  const [assetsRes, customersRes] = await Promise.all([
    supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_customers")
      .select("id, name")
      .eq("client_id", clientId)
      .order("name"),
  ]);

  return {
    assets: (assetsRes.data ?? []) as Asset[],
    customers: (customersRes.data ?? []) as Pick<CrmCustomer, "id" | "name">[],
  };
}

export default async function AssetsPage() {
  const { assets, customers } = await getAssetsData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
      <p className="mt-2 text-muted-foreground">
        Templates, diagrams, and documents you use.
      </p>
      <div className="mt-6">
        <AssetList assets={assets} customers={customers} />
      </div>
    </div>
  );
}
