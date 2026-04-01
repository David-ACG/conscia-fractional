import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { getNextInvoiceNumber } from "@/lib/actions/invoices";
import { InvoiceList } from "@/components/invoicing/invoice-list";
import type { Invoice } from "@/lib/types";

async function getInvoicingData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { invoices: [], engagement: null };

  const supabase = createClient();
  if (!supabase) return { invoices: [], engagement: null };

  const [invoicesRes, engagementRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .order("period_end", { ascending: false }),
    supabase
      .from("engagements")
      .select("day_rate_gbp, hourly_rate_gbp, hours_per_week")
      .eq("client_id", clientId)
      .eq("status", "active")
      .limit(1)
      .single(),
  ]);

  return {
    invoices: (invoicesRes.data ?? []) as Invoice[],
    engagement: engagementRes.data,
  };
}

export default async function InvoicingPage() {
  const { invoices, engagement } = await getInvoicingData();
  const nextInvoiceNumber = await getNextInvoiceNumber();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Invoicing</h1>
      <p className="mt-2 text-muted-foreground">
        Generate invoice line-item text from timesheet data, broken down by
        month.
      </p>
      <div className="mt-6">
        <InvoiceList
          invoices={invoices}
          engagement={engagement}
          nextInvoiceNumber={nextInvoiceNumber}
        />
      </div>
    </div>
  );
}
