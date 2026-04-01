"use client";

import * as React from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  History,
  FilePlus,
  Pencil,
  Trash2,
  Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeliverableForm } from "./deliverable-form";
import { VersionHistory } from "./version-history";
import { NewVersionDialog } from "./new-version-dialog";
import { deleteDeliverable } from "@/lib/actions/deliverables";
import { toast } from "sonner";
import type { Deliverable, CrmCustomer } from "@/lib/types";

const statusConfig: Record<
  string,
  { label: string; className: string; activeClassName: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
    activeClassName:
      "bg-slate-800 text-slate-100 dark:bg-slate-300 dark:text-slate-800",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50",
    activeClassName:
      "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-900",
  },
  review: {
    label: "Review",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50",
    activeClassName:
      "bg-amber-600 text-white dark:bg-amber-400 dark:text-amber-900",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50",
    activeClassName:
      "bg-green-600 text-white dark:bg-green-400 dark:text-green-900",
  },
};

type DeliverableWithCustomer = Deliverable & {
  crm_customer?: { name: string } | null;
};

interface DeliverableListProps {
  deliverables: DeliverableWithCustomer[];
  customers: CrmCustomer[];
}

export function DeliverableList({
  deliverables,
  customers,
}: DeliverableListProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [customerFilter, setCustomerFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] =
    React.useState<DeliverableWithCustomer | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = React.useState(false);
  const [versionHistoryTarget, setVersionHistoryTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newVersionOpen, setNewVersionOpen] = React.useState(false);
  const [newVersionTarget, setNewVersionTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      draft: 0,
      in_progress: 0,
      review: 0,
      delivered: 0,
    };
    for (const d of deliverables) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  }, [deliverables]);

  const filtered = React.useMemo(() => {
    let result = deliverables;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (customerFilter !== "all") {
      if (customerFilter === "__none__") {
        result = result.filter((d) => !d.crm_customer_id);
      } else {
        result = result.filter((d) => d.crm_customer_id === customerFilter);
      }
    }
    return result;
  }, [deliverables, search, statusFilter, customerFilter]);

  function handleEdit(item: DeliverableWithCustomer) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingItem(null);
  }

  function toggleStatusFilter(status: string) {
    setStatusFilter((prev) => (prev === status ? "all" : status));
  }

  function formatDueDate(dateStr: string | null) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = date.getTime() - now.getTime();
    const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));

    const formatted = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (daysUntil < 0) {
      return (
        <span className="text-red-600 dark:text-red-400 font-medium">
          {formatted}
        </span>
      );
    }
    if (daysUntil <= 3) {
      return (
        <span className="text-amber-600 dark:text-amber-400 font-medium">
          {formatted}
        </span>
      );
    }
    return <span>{formatted}</span>;
  }

  async function handleDelete(id: string) {
    const result = await deleteDeliverable(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Deliverable deleted");
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deliverables..."
            className="pl-9"
          />
        </div>

        {/* Customer filter */}
        {customers.length > 0 && (
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              <SelectItem value="__none__">Conscia</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-1.5">
          {(
            Object.entries(statusConfig) as [
              string,
              (typeof statusConfig)[string],
            ][]
          ).map(([status, config]) => (
            <button
              key={status}
              onClick={() => toggleStatusFilter(status)}
              className="inline-flex items-center"
            >
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors ${
                  statusFilter === status
                    ? config.activeClassName
                    : config.className
                }`}
              >
                {config.label} ({statusCounts[status] ?? 0})
              </Badge>
            </button>
          ))}
        </div>

        <Button
          onClick={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Deliverable
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No deliverables match your filters."
              : "No deliverables yet. Track documents and artifacts you produce."}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const si = statusConfig[d.status] ?? statusConfig.draft;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.crm_customer?.name ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={si.className.split(" hover:")[0]}
                      >
                        {si.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDueDate(d.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">v{d.version}</Badge>
                    </TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(d)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setNewVersionTarget({ id: d.id, name: d.name });
                              setNewVersionOpen(true);
                            }}
                          >
                            <FilePlus className="mr-2 h-4 w-4" />
                            New Version
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setVersionHistoryTarget({
                                id: d.id,
                                name: d.name,
                              });
                              setVersionHistoryOpen(true);
                            }}
                          >
                            <History className="mr-2 h-4 w-4" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(d.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      <DeliverableForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        deliverable={editingItem}
        customers={customers}
      />

      {versionHistoryTarget && (
        <VersionHistory
          deliverableId={versionHistoryTarget.id}
          deliverableName={versionHistoryTarget.name}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
        />
      )}

      {newVersionTarget && (
        <NewVersionDialog
          deliverableId={newVersionTarget.id}
          deliverableName={newVersionTarget.name}
          open={newVersionOpen}
          onOpenChange={setNewVersionOpen}
        />
      )}
    </>
  );
}
