# PROMPT: Invoicing Module

## Context

FractionalBuddy is a Next.js 16 app for fractional executives. The Invoicing page is a placeholder. The invoices table already exists in Supabase with RLS. The client switcher provides `getActiveClientId()`. David invoices clients using day rates. He needs to generate copyable invoice line-item text from timesheet data, broken down by month.

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), Supabase, react-hook-form, zod

**Invoice text format** (from David's actual invoices):

```
Quantity: 11.125 Days
Details:
  Jan 23 - 1 day
  Feb 23 - 2.25 days
  Mar 23 - 2.875 days
  Apr 23 - 1.25 days
  ...
  Total for Jan to Jul 23 = 11.125
  Timesheets available on request
Unit Price: £500.00
Subtotal: £5,562.50
```

## Database Schema (already exists — DO NOT create migrations)

### invoices

```
id uuid PK, client_id uuid FK, freeagent_invoice_id text,
invoice_number text, period_start date, period_end date,
total_hours decimal(10,2), total_amount_gbp decimal(10,2),
status text DEFAULT 'draft', paid_on date,
is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Status values: `draft`, `sent`, `viewed`, `overdue`, `paid`

### time_entries (read-only for invoicing)

```
id uuid PK, client_id uuid FK, category text, description text,
started_at timestamptz, stopped_at timestamptz,
duration_minutes decimal(10,2), is_billable boolean DEFAULT true,
created_at timestamptz, updated_at timestamptz
```

### engagements (read-only — for rates)

```
day_rate_gbp decimal(10,2), hourly_rate_gbp decimal(10,2),
hours_per_week integer DEFAULT 16
```

### Invoice type (already in src/lib/types.ts)

Already defined. DO NOT recreate.

## What to Build

### 1. Invoice Server Actions (`src/lib/actions/invoices.ts`)

````typescript
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/actions/clients";

// createInvoice(data) — invoice_number, period_start, period_end, status
//   1. Get clientId from getActiveClientId()
//   2. Fetch all BILLABLE time entries in the period (is_billable = true)
//   3. Calculate total_hours = sum of duration_minutes / 60
//   4. Fetch engagement for day_rate_gbp
//   5. Calculate total_amount_gbp:
//      - Convert hours to days: total_hours / (contract_hours_per_week / 5)
//        OR simpler: total_hours / 8 (standard 8h day)
//        Actually use the engagement's hours_per_week / 5 to get hours_per_day
//      - total_days * day_rate_gbp
//   6. Insert invoice with calculated totals
//   7. revalidatePath("/invoicing")
//   8. Return { success: true, invoiceId }

// updateInvoice(id, data) — update status, paid_on, invoice_number

// deleteInvoice(id)

// markAsPaid(id, paidOn: string)
//   Update status to 'paid' and set paid_on date

// generateInvoiceText(invoiceId: string) → string
//   This is the KEY function. It generates copyable text in David's format:
//   1. Fetch the invoice (period_start, period_end, total_hours, total_amount_gbp)
//   2. Fetch engagement (day_rate_gbp, hours_per_week)
//   3. Fetch all billable time entries in the period, grouped by month
//   4. Calculate hours_per_day = hours_per_week / 5
//   5. For each month in the period:
//      - Sum duration_minutes for that month
//      - Convert to days: (month_minutes / 60) / hours_per_day
//      - Format as: "Jan 26 - 1.25 days"
//   6. Calculate total days across all months
//   7. Build the text:
//      ```
//      {total_days} Days
//
//      {month lines, one per line}
//
//      Total for {first_month} to {last_month} = {total_days}
//
//      Timesheets available on request
//
//      Unit Price (£): {day_rate}
//      Subtotal (£): {total_amount}
//      ```
//   8. Return the text string

// getInvoicePreview(periodStart: string, periodEnd: string)
//   Preview BEFORE creating — same calculation as generateInvoiceText but without saving
//   Returns { totalHours, totalDays, totalAmount, monthBreakdown, text }
````

### 2. Invoicing Page (`src/app/(dashboard)/invoicing/page.tsx`)

Replace placeholder. Async server component:

```typescript
async function getInvoicingData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { invoices: [], engagement: null };

  const supabase = await createClient();
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
```

### 3. Invoice List Component (`src/components/invoicing/invoice-list.tsx`)

"use client" component:

**Top section: "Create Invoice" card**

- Period selector: two date inputs (period_start, period_end)
- "Preview" button → calls getInvoicePreview, shows the month breakdown and totals
- "Create Invoice" button → creates the invoice and shows the text

**Invoice table below:**

| Invoice # | Period | Days | Amount | Status | Created | Actions |
| --------- | ------ | ---- | ------ | ------ | ------- | ------- |

- Invoice #: text or auto-generated (e.g. "INV-001")
- Period: "Jan 26 — Mar 26"
- Days: total days (e.g. "11.125")
- Amount: "£5,562.50"
- Status: colored badge:
  - draft: gray
  - sent: blue
  - viewed: purple
  - overdue: red
  - paid: green
- Created: date
- Actions: dropdown with View Text, Mark as Sent, Mark as Paid, Edit, Delete

**Empty state:** "No invoices yet. Select a period above to generate your first invoice."

### 4. Invoice Preview/Text Component (`src/components/invoicing/invoice-preview.tsx`)

Shows the generated invoice text in a styled card:

```
"use client"
// Props: { text: string, totalDays: number, totalAmount: number, dayRate: number }
//
// Display:
// - Pre-formatted text in a monospace card (bg-muted, rounded-lg, p-4)
// - "Copy to Clipboard" button (copies the text)
// - Toast: "Invoice text copied!"
//
// The text looks like:
// ┌──────────────────────────────────────────────┐
// │ 11.125 Days                                   │
// │                                                │
// │ Jan 26 - 1 day                                │
// │ Feb 26 - 2.25 days                            │
// │ Mar 26 - 2.875 days                           │
// │ ...                                            │
// │                                                │
// │ Total for Jan to Mar 26 = 11.125              │
// │                                                │
// │ Timesheets available on request               │
// │                                                │
// │ Unit Price (£): 500.00                        │
// │ Subtotal (£): 5,562.50                        │
// └──────────────────────────────────────────────┘
// [Copy to Clipboard]
```

### 5. Invoice Form (`src/components/invoicing/invoice-form.tsx`)

Small dialog for editing invoice metadata:

- invoice_number (text)
- status (select: Draft/Sent/Viewed/Overdue/Paid)
- paid_on (date input, only shown when status is "paid")
- is_client_visible (checkbox)

The period, hours, and amount are calculated — not manually editable.

### 6. Month Breakdown Calculation

Key helper for grouping time entries by month:

```typescript
interface MonthBreakdown {
  month: string; // "Jan 26"
  totalMinutes: number;
  totalDays: number; // minutes / 60 / hoursPerDay
  label: string; // "Jan 26 - 2.25 days"
}

function calculateMonthBreakdown(
  entries: { started_at: string; duration_minutes: number | null }[],
  hoursPerDay: number,
): MonthBreakdown[] {
  // Group entries by month (Mon YY format)
  // Sum duration_minutes per month
  // Convert to days: (totalMinutes / 60) / hoursPerDay
  // Format days: use singular "day" for 1, "days" for others
  // Round to 3 decimal places (to match David's format: 2.875)
  // Return sorted by date ascending
}
```

**Day formatting rules** (from David's invoice):

- 1 exactly → "1 day"
- Anything else → "X.XXX days" (up to 3 decimal places, trim trailing zeros)
- Examples: "1 day", "2.25 days", "2.875 days", "1.5 days"

### 7. Auto Invoice Number

When creating an invoice, auto-suggest the next invoice number:

- Fetch the most recent invoice for this client
- If it has a number like "INV-003", suggest "INV-004"
- If no previous invoices, suggest "INV-001"
- The user can override this

## Acceptance Criteria

- [ ] Invoicing page replaces placeholder
- [ ] Period selector (start/end dates) at top
- [ ] "Preview" shows month-by-month breakdown before creating
- [ ] "Create Invoice" saves to DB with calculated totals
- [ ] Generated text matches David's format exactly (month lines, total, unit price, subtotal)
- [ ] "Copy to Clipboard" button copies the invoice text
- [ ] Invoice table shows all invoices sorted by period (newest first)
- [ ] Status badges color-coded
- [ ] "Mark as Sent" and "Mark as Paid" quick actions
- [ ] Edit invoice metadata (number, status, paid date)
- [ ] Delete invoice
- [ ] Auto-suggest next invoice number
- [ ] Days calculated from billable time entries only (is_billable = true)
- [ ] Day rate pulled from active engagement
- [ ] Hours-per-day derived from engagement's hours_per_week / 5
- [ ] All forms validate with zod
- [ ] Toast feedback
- [ ] Existing tests pass (`npm test`)
- [ ] New tests: invoices.test.ts

## Test Expectations

`src/lib/actions/__tests__/invoices.test.ts`:

- Test month breakdown calculation with sample entries
- Test day formatting (singular vs plural, decimal trimming)
- Test total calculation (days \* rate)
- Test auto invoice number generation
- Test createInvoice
- Test markAsPaid

## Files to Create

- `src/lib/actions/invoices.ts`
- `src/lib/actions/__tests__/invoices.test.ts`
- `src/components/invoicing/invoice-list.tsx`
- `src/components/invoicing/invoice-preview.tsx`
- `src/components/invoicing/invoice-form.tsx`

## Files to Modify

- `src/app/(dashboard)/invoicing/page.tsx` — replace placeholder

---

## Review Checklist — 2026-03-27 10:50

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct
- [ ] Acceptance criteria match the plan
- [ ] Invoice text format matches David's actual invoices
- [ ] No scope creep (FreeAgent integration is Phase 4)
- [ ] Day calculation uses engagement hours_per_week / 5

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-27_02-invoicing.md`
