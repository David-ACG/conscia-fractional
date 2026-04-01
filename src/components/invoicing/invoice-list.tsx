"use client";

import * as React from "react";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Send,
  CheckCircle,
  Pencil,
  Trash2,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoicePreview } from "./invoice-preview";
import { InvoiceForm } from "./invoice-form";
import {
  createInvoice,
  getInvoicePreview,
  generateInvoiceText,
  updateInvoice,
  markAsPaid,
  getNextInvoiceNumber,
} from "@/lib/actions/invoices";
import type { Invoice } from "@/lib/types";

interface InvoiceListProps {
  invoices: Invoice[];
  engagement: {
    day_rate_gbp: number | null;
    hourly_rate_gbp: number | null;
    hours_per_week: number | null;
  } | null;
  nextInvoiceNumber: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
  sent: {
    label: "Sent",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  viewed: {
    label: "Viewed",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  paid: {
    label: "Paid",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  return `${fmt(s)} — ${fmt(e)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—";
  return `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTotalDays(
  hours: number | null,
  hoursPerWeek: number | null,
): string {
  if (hours == null) return "—";
  const hoursPerDay = (hoursPerWeek ?? 40) / 5;
  const days = hours / hoursPerDay;
  return parseFloat(days.toFixed(3)).toString();
}

export function InvoiceList({
  invoices,
  engagement,
  nextInvoiceNumber,
}: InvoiceListProps) {
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [previewData, setPreviewData] = React.useState<{
    text: string;
    totalDays: number;
    totalAmount: number;
    dayRate: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [editInvoice, setEditInvoice] = React.useState<Invoice | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [viewText, setViewText] = React.useState<{
    text: string;
    totalDays: number;
    totalAmount: number;
    dayRate: number;
  } | null>(null);
  const [viewLoading, setViewLoading] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [suggestedNumber, setSuggestedNumber] =
    React.useState(nextInvoiceNumber);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  async function handlePreview() {
    if (!periodStart || !periodEnd) {
      toast.error("Select both start and end dates");
      return;
    }
    setPreviewLoading(true);
    const result = await getInvoicePreview(periodStart, periodEnd);
    setPreviewLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setPreviewData({
      text: result.text!,
      totalDays: result.totalDays!,
      totalAmount: result.totalAmount!,
      dayRate: result.dayRate!,
    });
  }

  async function handleCreate() {
    if (!periodStart || !periodEnd) {
      toast.error("Select both start and end dates");
      return;
    }
    setCreateLoading(true);
    const result = await createInvoice({
      invoice_number: suggestedNumber,
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
    });
    setCreateLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice created");
    setPreviewData(null);
    setPeriodStart("");
    setPeriodEnd("");
    // Refresh suggested number
    const next = await getNextInvoiceNumber();
    setSuggestedNumber(next);
  }

  async function handleViewText(invoiceId: string) {
    setViewLoading(invoiceId);
    const result = await generateInvoiceText(invoiceId);
    setViewLoading(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setViewText({
      text: result.text!,
      totalDays: result.totalDays!,
      totalAmount: result.totalAmount!,
      dayRate: result.dayRate!,
    });
  }

  async function handleMarkAsSent(id: string) {
    const result = await updateInvoice(id, { status: "sent" });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked as sent");
  }

  async function handleMarkAsPaid(id: string) {
    const today = new Date().toISOString().split("T")[0];
    const result = await markAsPaid(id, today);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked as paid");
  }

  return (
    <div className="space-y-6">
      {/* Create Invoice Section */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Create Invoice</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Invoice Number</label>
            <Input
              value={suggestedNumber}
              onChange={(e) => setSuggestedNumber(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Period Start</label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Period End</label>
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewLoading || !periodStart || !periodEnd}
          >
            <Eye className="mr-2 h-4 w-4" />
            {previewLoading ? "Loading…" : "Preview"}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createLoading || !periodStart || !periodEnd}
          >
            <Plus className="mr-2 h-4 w-4" />
            {createLoading ? "Creating…" : "Create Invoice"}
          </Button>
        </div>

        {previewData && (
          <div className="mt-4">
            <InvoicePreview
              text={previewData.text}
              totalDays={previewData.totalDays}
              totalAmount={previewData.totalAmount}
              dayRate={previewData.dayRate}
            />
          </div>
        )}
      </Card>

      {/* View Text Panel */}
      {viewText && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Invoice Text</h2>
            <Button variant="ghost" size="sm" onClick={() => setViewText(null)}>
              Close
            </Button>
          </div>
          <InvoicePreview
            text={viewText.text}
            totalDays={viewText.totalDays}
            totalAmount={viewText.totalAmount}
            dayRate={viewText.dayRate}
          />
        </Card>
      )}

      {/* Invoice Table */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {invoices.length === 0
                ? "No invoices yet. Select a period above to generate your first invoice."
                : "No invoices match your search."}
            </p>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const status = statusConfig[inv.status] ?? statusConfig.draft;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        {inv.invoice_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        {formatPeriod(inv.period_start, inv.period_end)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTotalDays(
                          inv.total_hours,
                          engagement?.hours_per_week ?? null,
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAmount(inv.total_amount_gbp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(inv.created_at)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewText(inv.id)}
                              disabled={viewLoading === inv.id}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              {viewLoading === inv.id
                                ? "Loading…"
                                : "View Text"}
                            </DropdownMenuItem>
                            {inv.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handleMarkAsSent(inv.id)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {inv.status !== "paid" && (
                              <DropdownMenuItem
                                onClick={() => handleMarkAsPaid(inv.id)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setEditInvoice(inv);
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <InvoiceForm
        open={editOpen}
        onOpenChange={setEditOpen}
        invoice={editInvoice}
      />
    </div>
  );
}
