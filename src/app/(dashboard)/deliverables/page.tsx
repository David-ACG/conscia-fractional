import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { DeliverableList } from "@/components/deliverables/deliverable-list";
import type { Deliverable, CrmCustomer } from "@/lib/types";

async function getDeliverablesData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { deliverables: [], customers: [] };

  const supabase = createClient();
  if (!supabase) return { deliverables: [], customers: [] };

  const [deliverablesResult, customersResult] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*, crm_customer:crm_customers(name)")
      .eq("client_id", clientId)
      .order("due_date", { ascending: true }),
    supabase
      .from("crm_customers")
      .select("*")
      .eq("client_id", clientId)
      .order("name"),
  ]);

  return {
    deliverables: (deliverablesResult.data ?? []) as (Deliverable & {
      crm_customer: { name: string } | null;
    })[],
    customers: (customersResult.data ?? []) as CrmCustomer[],
  };
}

export default async function DeliverablesPage() {
  const { deliverables, customers } = await getDeliverablesData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
      <p className="mt-2 text-muted-foreground">
        Track documents and artifacts you produce for clients.
      </p>
      <div className="mt-6">
        <DeliverableList deliverables={deliverables} customers={customers} />
      </div>
    </div>
  );
}
