import { createAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PortalEmptyState } from "./portal-empty-state";
import { Receipt } from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface PortalInvoicingProps {
  clientId: string;
}

const statusConfig: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  draft: { variant: "secondary" },
  sent: { variant: "default", className: "bg-blue-600" },
  viewed: { variant: "default", className: "bg-purple-600" },
  overdue: { variant: "destructive" },
  paid: { variant: "default", className: "bg-green-600" },
};

export async function PortalInvoicing({ clientId }: PortalInvoicingProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: invoices } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, period_start, period_end, total_hours, total_amount_gbp, status, created_at",
    )
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  if (!invoices || invoices.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <PortalEmptyState
          icon={<Receipt className="size-10" />}
          title="No invoices shared yet"
          description="Invoices will appear here once they are shared with you."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const config = statusConfig[inv.status] ?? {
                  variant: "outline" as const,
                };
                const periodStart = inv.period_start
                  ? new Date(inv.period_start)
                  : null;
                const periodEnd = inv.period_end
                  ? new Date(inv.period_end)
                  : null;

                // Calculate days from hours (assuming 8h day)
                const days = inv.total_hours
                  ? Math.round((inv.total_hours / 8) * 10) / 10
                  : null;

                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      INV-{inv.invoice_number ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {periodStart &&
                      isValid(periodStart) &&
                      periodEnd &&
                      isValid(periodEnd)
                        ? `${format(periodStart, "d MMM")} – ${format(periodEnd, "d MMM yyyy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {days !== null ? days : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.total_amount_gbp !== null
                        ? `£${inv.total_amount_gbp.toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={config.variant}
                        className={cn(config.className)}
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(inv.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
