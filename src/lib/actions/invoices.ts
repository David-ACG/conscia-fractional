"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  type InvoiceCreateData,
  type InvoiceUpdateData,
} from "@/lib/validations/invoices";

// --- Helpers (exported for testing) ---

export interface MonthBreakdown {
  month: string; // "January 2026"
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  label: string; // "January 2026 - 4.25 hours (0.531 days)"
}

export async function formatDays(days: number): Promise<string> {
  if (days === 1) return "1 day";
  // Round to 3 decimal places, trim trailing zeros
  const rounded = parseFloat(days.toFixed(3));
  return `${rounded} days`;
}

export async function formatHours(hours: number): Promise<string> {
  if (hours === 1) return "1 hour";
  const rounded = parseFloat(hours.toFixed(2));
  return `${rounded} hours`;
}

export async function calculateMonthBreakdown(
  entries: { started_at: string; duration_minutes: number | null }[],
  hoursPerDay: number,
): Promise<MonthBreakdown[]> {
  const monthMap = new Map<string, number>();
  const monthOrder = new Map<string, Date>();

  for (const entry of entries) {
    if (!entry.duration_minutes) continue;
    const date = new Date(entry.started_at);
    const monthKey = date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    monthMap.set(
      monthKey,
      (monthMap.get(monthKey) ?? 0) + entry.duration_minutes,
    );
    if (!monthOrder.has(monthKey)) {
      monthOrder.set(
        monthKey,
        new Date(date.getFullYear(), date.getMonth(), 1),
      );
    }
  }

  const sorted = [...monthMap.entries()].sort((a, b) => {
    const dateA = monthOrder.get(a[0])!;
    const dateB = monthOrder.get(b[0])!;
    return dateA.getTime() - dateB.getTime();
  });

  return Promise.all(
    sorted.map(async ([month, totalMinutes]) => {
      const totalHours = totalMinutes / 60;
      const totalDays = totalHours / hoursPerDay;
      return {
        month,
        totalMinutes,
        totalHours,
        totalDays,
        label: `${month} - ${await formatHours(totalHours)} (${await formatDays(totalDays)})`,
      };
    }),
  );
}

export async function buildInvoiceText(
  breakdown: MonthBreakdown[],
  totalDays: number,
  dayRate: number,
  totalAmount: number,
  hoursPerDay: number = 8,
  periodStart?: string,
  periodEnd?: string,
): Promise<string> {
  const monthLines = breakdown.map((m) => m.label).join("\n");

  // Format period dates as "30/03/2026 to 05/04/2026"
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
  const periodLabel =
    periodStart && periodEnd
      ? `${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`
      : (() => {
          const firstMonth = breakdown[0]?.month ?? "";
          const lastMonth = breakdown[breakdown.length - 1]?.month ?? "";
          return firstMonth === lastMonth
            ? firstMonth
            : `${firstMonth} to ${lastMonth}`;
        })();

  const totalHours = totalDays * hoursPerDay;
  const hourlyRate = dayRate / hoursPerDay;

  const formattedRate = dayRate.toFixed(2);
  const formattedTotal = totalAmount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedDays = parseFloat(totalDays.toFixed(3));
  const formattedHours = parseFloat(totalHours.toFixed(2));

  return [
    `Period: ${periodLabel}`,
    "",
    `${formattedHours} Hours (${formattedDays} Days)`,
    "",
    monthLines,
    "",
    `Total for ${periodLabel} = ${formattedHours} hours (${formattedDays} days)`,
    "",
    "Timesheets available on request",
    "",
    `${formattedHours} hours x £${hourlyRate.toFixed(2)}/hr = £${formattedTotal}`,
    "",
    `Day Rate (£): ${formattedRate}`,
    `Hourly Rate (£): ${hourlyRate.toFixed(2)}`,
    `Subtotal (£): ${formattedTotal}`,
  ].join("\n");
}

export async function suggestNextInvoiceNumber(
  lastNumber: string | null,
): Promise<string> {
  if (!lastNumber) return "INV-001";
  const match = lastNumber.match(/^(.*?)(\d+)$/);
  if (!match) return "INV-001";
  const prefix = match[1];
  const num = parseInt(match[2], 10) + 1;
  const padded = String(num).padStart(match[2].length, "0");
  return `${prefix}${padded}`;
}

// --- Server Actions ---

export async function getNextInvoiceNumber() {
  const supabase = createClient();
  if (!supabase) return "INV-001";

  const clientId = await getActiveClientId();
  if (!clientId) return "INV-001";

  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return await suggestNextInvoiceNumber(data?.invoice_number ?? null);
}

export async function createInvoice(data: InvoiceCreateData) {
  const parsed = invoiceCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  // Fetch billable time entries in period
  const { data: entries } = await supabase
    .from("time_entries")
    .select("started_at, duration_minutes")
    .eq("client_id", clientId)
    .eq("is_billable", true)
    .gte("started_at", parsed.data.period_start)
    .lte("started_at", `${parsed.data.period_end}T23:59:59`);

  // Fetch engagement for rate
  const { data: engagement } = await supabase
    .from("engagements")
    .select("day_rate_gbp, hours_per_week")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .single();

  const hoursPerDay = 8; // Standard 8-hour day for day rate calculation
  const dayRate = engagement?.day_rate_gbp ?? 0;

  const totalMinutes = (entries ?? []).reduce(
    (sum, e) => sum + (e.duration_minutes ?? 0),
    0,
  );
  const totalHours = totalMinutes / 60;
  const totalDays = totalHours / hoursPerDay;
  const totalAmount = parseFloat((totalDays * dayRate).toFixed(2));

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      client_id: clientId,
      invoice_number: parsed.data.invoice_number,
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      total_hours: parseFloat(totalHours.toFixed(2)),
      total_amount_gbp: totalAmount,
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/invoicing");
  return { success: true, invoiceId: invoice?.id };
}

export async function updateInvoice(id: string, data: InvoiceUpdateData) {
  const parsed = invoiceUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const updateData: Record<string, unknown> = {};
  if (parsed.data.invoice_number !== undefined)
    updateData.invoice_number = parsed.data.invoice_number;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.paid_on !== undefined)
    updateData.paid_on = parsed.data.paid_on;
  if (parsed.data.is_client_visible !== undefined)
    updateData.is_client_visible = parsed.data.is_client_visible;

  const { error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/invoicing");
  return { success: true };
}

export async function deleteInvoice(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("invoices").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/invoicing");
  return { success: true };
}

export async function markAsPaid(id: string, paidOn: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_on: paidOn })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/invoicing");
  return { success: true };
}

export async function generateInvoiceText(invoiceId: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { error: "Invoice not found" };

  const { data: engagement } = await supabase
    .from("engagements")
    .select("day_rate_gbp, hours_per_week")
    .eq("client_id", invoice.client_id)
    .eq("status", "active")
    .limit(1)
    .single();

  const hoursPerDay = 8; // Standard 8-hour day for day rate calculation
  const dayRate = engagement?.day_rate_gbp ?? 0;

  const { data: entries } = await supabase
    .from("time_entries")
    .select("started_at, duration_minutes")
    .eq("client_id", invoice.client_id)
    .eq("is_billable", true)
    .gte("started_at", invoice.period_start)
    .lte("started_at", `${invoice.period_end}T23:59:59`);

  const breakdown = await calculateMonthBreakdown(entries ?? [], hoursPerDay);
  const totalDays = breakdown.reduce((sum, m) => sum + m.totalDays, 0);
  const totalHours = breakdown.reduce((sum, m) => sum + m.totalHours, 0);
  const totalAmount = invoice.total_amount_gbp ?? totalDays * dayRate;

  const text = await buildInvoiceText(
    breakdown,
    totalDays,
    dayRate,
    totalAmount,
    hoursPerDay,
    invoice.period_start,
    invoice.period_end,
  );

  return {
    success: true,
    text,
    totalDays,
    totalHours,
    totalAmount,
    dayRate,
    breakdown,
  };
}

export async function getInvoicePreview(
  periodStart: string,
  periodEnd: string,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const [entriesRes, engagementRes] = await Promise.all([
    supabase
      .from("time_entries")
      .select("started_at, duration_minutes")
      .eq("client_id", clientId)
      .eq("is_billable", true)
      .gte("started_at", periodStart)
      .lte("started_at", `${periodEnd}T23:59:59`),
    supabase
      .from("engagements")
      .select("day_rate_gbp, hours_per_week")
      .eq("client_id", clientId)
      .eq("status", "active")
      .limit(1)
      .single(),
  ]);

  const entries = entriesRes.data ?? [];
  const engagement = engagementRes.data;
  const hoursPerDay = 8; // Standard 8-hour day for day rate calculation
  const dayRate = engagement?.day_rate_gbp ?? 0;

  const breakdown = await calculateMonthBreakdown(entries, hoursPerDay);
  const totalMinutes = entries.reduce(
    (sum, e) => sum + (e.duration_minutes ?? 0),
    0,
  );
  const totalHours = totalMinutes / 60;
  const totalDays = totalHours / hoursPerDay;
  const totalAmount = parseFloat((totalDays * dayRate).toFixed(2));

  const text = await buildInvoiceText(
    breakdown,
    totalDays,
    dayRate,
    totalAmount,
    hoursPerDay,
    periodStart,
    periodEnd,
  );

  return {
    success: true,
    totalHours,
    totalDays,
    totalAmount,
    dayRate,
    monthBreakdown: breakdown,
    text,
  };
}
