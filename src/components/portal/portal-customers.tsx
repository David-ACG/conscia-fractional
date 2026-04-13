import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalEmptyState } from "./portal-empty-state";
import { Building2 } from "lucide-react";

interface PortalCustomersProps {
  clientId: string;
}

export async function PortalCustomers({ clientId }: PortalCustomersProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: customers } = await admin
    .from("crm_customers")
    .select("id, name, industry, description, status, primary_contact")
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("name", { ascending: true });

  if (!customers || customers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <PortalEmptyState
          icon={<Building2 className="size-10" />}
          title="No customers shared yet"
          description="Customer information will appear here once shared with you."
        />
      </div>
    );
  }

  // Fetch summary counts per customer (only client-visible items)
  const customerSummaries = await Promise.all(
    customers.map(async (customer) => {
      const [tasksRes, meetingsRes, timeRes, deliverablesRes] =
        await Promise.all([
          admin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("crm_customer_id", customer.id)
            .eq("is_client_visible", true)
            .neq("status", "done"),
          admin
            .from("meetings")
            .select("id", { count: "exact", head: true })
            .eq("crm_customer_id", customer.id)
            .eq("is_client_visible", true),
          admin
            .from("time_entries")
            .select("duration_minutes")
            .eq("crm_customer_id", customer.id)
            .eq("is_client_visible", true),
          admin
            .from("deliverables")
            .select("id", { count: "exact", head: true })
            .eq("crm_customer_id", customer.id)
            .eq("is_client_visible", true),
        ]);

      const totalMinutes = (timeRes.data ?? []).reduce(
        (sum, e) => sum + (e.duration_minutes ?? 0),
        0,
      );
      const hours = Math.round((totalMinutes / 60) * 10) / 10;

      return {
        ...customer,
        openTasks: tasksRes.count ?? 0,
        meetings: meetingsRes.count ?? 0,
        hours,
        deliverables: deliverablesRes.count ?? 0,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
      <p className="text-muted-foreground">
        Customers we are actively working on for you.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customerSummaries.map((customer) => (
          <Card
            key={customer.id}
            className="transition-colors hover:border-primary/30"
          >
            <CardContent className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{customer.name}</h3>
                    {customer.industry && (
                      <p className="text-xs text-muted-foreground truncate">
                        {customer.industry}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={
                    customer.status === "active" ? "default" : "secondary"
                  }
                  className={
                    customer.status === "active"
                      ? "bg-green-600 hover:bg-green-600"
                      : ""
                  }
                >
                  {customer.status}
                </Badge>
              </div>

              {customer.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {customer.description}
                </p>
              )}

              {customer.primary_contact && (
                <p className="text-xs text-muted-foreground">
                  Contact: {customer.primary_contact}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Stat label="Open Tasks" value={customer.openTasks} />
                <Stat label="Meetings" value={customer.meetings} />
                <Stat label="Hours" value={`${customer.hours}h`} />
                <Stat label="Deliverables" value={customer.deliverables} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
