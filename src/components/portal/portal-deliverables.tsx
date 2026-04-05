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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PortalEmptyState } from "./portal-empty-state";
import { FileOutput, Download } from "lucide-react";
import { format, isPast, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface PortalDeliverablesProps {
  clientId: string;
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  in_progress: "default",
  review: "outline",
  delivered: "default",
};

export async function PortalDeliverables({
  clientId,
}: PortalDeliverablesProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: deliverables } = await admin
    .from("deliverables")
    .select(
      "id, name, status, due_date, version, file_url, file_name, created_at",
    )
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  if (!deliverables || deliverables.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
        <PortalEmptyState
          icon={<FileOutput className="size-10" />}
          title="No deliverables shared yet"
          description="Deliverables will appear here once they are shared with you."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-20 text-right">Version</TableHead>
                <TableHead className="w-28 text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.map((d) => {
                const dueDate = d.due_date ? new Date(d.due_date) : null;
                const isOverdue =
                  dueDate &&
                  isValid(dueDate) &&
                  isPast(dueDate) &&
                  d.status !== "delivered";

                return (
                  <TableRow
                    key={d.id}
                    className={cn(isOverdue && "bg-red-50 dark:bg-red-950/20")}
                  >
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[d.status] ?? "outline"}
                        className={cn(
                          d.status === "delivered" && "bg-green-600",
                        )}
                      >
                        {d.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap",
                        isOverdue &&
                          "font-medium text-red-600 dark:text-red-400",
                      )}
                    >
                      {dueDate && isValid(dueDate)
                        ? format(dueDate, "d MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">v{d.version}</TableCell>
                    <TableCell className="text-right">
                      {d.file_url ? (
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <Download className="mr-1 size-4" />
                            Download
                          </Button>
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
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
