"use client";

import * as React from "react";
import { Search, Plus, MoreHorizontal, ExternalLink } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CrmForm } from "./crm-form";
import type { CrmCustomer } from "@/lib/types";

const statusConfig: Record<string, { label: string; className: string }> = {
  prospect: {
    label: "Prospect",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  active: {
    label: "Active",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  completed: {
    label: "Completed",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
  lost: {
    label: "Lost",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface CrmTableProps {
  customers: CrmCustomer[];
  taskCounts: Record<string, number>;
  deliverableCounts: Record<string, number>;
}

export function CrmTable({
  customers,
  taskCounts,
  deliverableCounts,
}: CrmTableProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] =
    React.useState<CrmCustomer | null>(null);

  const filtered = React.useMemo(() => {
    let result = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.industry && c.industry.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [customers, search, statusFilter]);

  function handleEdit(customer: CrmCustomer) {
    setEditingCustomer(customer);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingCustomer(null);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or industry..."
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={() => {
            setEditingCustomer(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No customers match your filters."
              : "No customers yet. Add your first customer to start tracking."}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Primary Contact</TableHead>
                <TableHead className="text-center">Tasks</TableHead>
                <TableHead className="text-center">Deliverables</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => {
                const status = statusConfig[customer.status];
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => handleEdit(customer)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{customer.name}</span>
                        {customer.website && (
                          <a
                            href={customer.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.industry || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={status.className}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.primary_contact || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {taskCounts[customer.id] ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {deliverableCounts[customer.id] ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
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
                            onClick={() => handleEdit(customer)}
                          >
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

      {/* Add/Edit dialog */}
      <CrmForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        customer={editingCustomer}
      />
    </>
  );
}
