import { notFound } from "next/navigation";
import { startOfMonth, endOfMonth } from "date-fns";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { getPortalSettings } from "@/lib/actions/portal";
import { CustomerDetailHeader } from "@/components/crm/customer-detail-header";
import { CustomerSummaryCards } from "@/components/crm/customer-summary-cards";
import { CustomerTabs } from "@/components/crm/customer-tabs";
import type {
  CrmCustomer,
  Meeting,
  Task,
  TimeEntry,
  Asset,
  Deliverable,
} from "@/lib/types";

async function getCustomerData(slug: string) {
  const clientId = await getActiveClientId();
  const supabase = createClient();

  if (!supabase || !clientId) return null;

  const { data: customer } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("client_id", clientId)
    .eq("slug", slug)
    .single();

  if (!customer) return null;

  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const [
    meetingsRes,
    tasksRes,
    timeEntriesRes,
    monthTimeRes,
    linkedAssetsRes,
    allClientAssetsRes,
    deliverablesRes,
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("meeting_date", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("started_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("duration_minutes")
      .eq("crm_customer_id", customer.id)
      .gte("started_at", monthStart)
      .lte("started_at", monthEnd),
    // Primary: assets linked by crm_customer_id
    supabase
      .from("assets")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("created_at", { ascending: false }),
    // Fallback: all client assets (for text-matching unlinked ones)
    supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .is("crm_customer_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("deliverables")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ]);

  // Combine linked assets with text-matched unlinked assets (legacy fallback)
  const linkedAssets = (linkedAssetsRes.data ?? []) as Asset[];
  const unlinkedAssets = (allClientAssetsRes.data ?? []) as Asset[];
  const customerName = customer.name.toLowerCase();
  const textMatched = unlinkedAssets.filter(
    (a) =>
      a.name.toLowerCase().includes(customerName) ||
      a.description?.toLowerCase().includes(customerName),
  );
  const customerAssets = [
    ...linkedAssets,
    ...textMatched.filter((t) => !linkedAssets.some((l) => l.id === t.id)),
  ];

  // Calculate hours this month
  const monthEntries = (monthTimeRes.data ?? []) as Pick<
    TimeEntry,
    "duration_minutes"
  >[];
  const hoursThisMonth = monthEntries.reduce(
    (sum, e) => sum + (e.duration_minutes ?? 0),
    0,
  );

  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const tasks = (tasksRes.data ?? []) as Task[];
  const timeEntries = (timeEntriesRes.data ?? []) as TimeEntry[];
  const deliverables = (deliverablesRes.data ?? []) as Deliverable[];

  const openTasks = tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  ).length;
  const activeDeliverables = deliverables.filter(
    (d) => d.status === "in_progress" || d.status === "review",
  ).length;

  // Check portal status
  const portalResult = await getPortalSettings(clientId);
  const isPortalActive = (portalResult.data ?? []).some((s) => s.is_enabled);

  return {
    customer: customer as CrmCustomer,
    meetings,
    tasks,
    timeEntries,
    assets: customerAssets,
    unlinkedTextMatchedAssets: textMatched,
    deliverables,
    isPortalActive,
    summary: {
      hoursThisMonth,
      openTasks,
      meetingsCount: meetings.length,
      activeDeliverables,
    },
  };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCustomerData(slug);

  if (!data) notFound();

  const {
    customer,
    meetings,
    tasks,
    timeEntries,
    assets,
    unlinkedTextMatchedAssets,
    deliverables,
    isPortalActive,
    summary,
  } = data;

  return (
    <div className="space-y-6">
      <CustomerDetailHeader
        customer={customer}
        isPortalActive={isPortalActive}
      />
      <CustomerSummaryCards summary={summary} />
      <CustomerTabs
        customer={customer}
        meetings={meetings}
        tasks={tasks}
        timeEntries={timeEntries}
        assets={assets}
        unlinkedTextMatchedAssets={unlinkedTextMatchedAssets}
        deliverables={deliverables}
      />
    </div>
  );
}
