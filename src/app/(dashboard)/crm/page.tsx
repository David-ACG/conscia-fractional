import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { CrmTable } from "@/components/crm/crm-table";
import type { CrmCustomer } from "@/lib/types";

async function getCrmData() {
  const clientId = await getActiveClientId();
  const supabase = createClient();

  if (!supabase || !clientId) {
    return { customers: [], taskCounts: {}, deliverableCounts: {} };
  }

  const { data: customers } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("client_id", clientId)
    .order("name", { ascending: true });

  const typedCustomers = (customers ?? []) as CrmCustomer[];
  const customerIds = typedCustomers.map((c) => c.id);

  const taskCounts: Record<string, number> = {};
  const deliverableCounts: Record<string, number> = {};

  if (customerIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("crm_customer_id")
      .in("crm_customer_id", customerIds);

    for (const t of tasks ?? []) {
      if (t.crm_customer_id) {
        taskCounts[t.crm_customer_id] =
          (taskCounts[t.crm_customer_id] ?? 0) + 1;
      }
    }

    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("crm_customer_id")
      .in("crm_customer_id", customerIds);

    for (const d of deliverables ?? []) {
      if (d.crm_customer_id) {
        deliverableCounts[d.crm_customer_id] =
          (deliverableCounts[d.crm_customer_id] ?? 0) + 1;
      }
    }
  }

  return { customers: typedCustomers, taskCounts, deliverableCounts };
}

export default async function CrmPage() {
  const { customers, taskCounts, deliverableCounts } = await getCrmData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your customer relationships.
      </p>

      <div className="mt-6">
        <CrmTable
          customers={customers}
          taskCounts={taskCounts}
          deliverableCounts={deliverableCounts}
        />
      </div>
    </div>
  );
}
