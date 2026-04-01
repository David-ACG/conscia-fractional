"use client";

import Link from "next/link";
import { ChevronLeft, ExternalLink, FolderOpen, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrmForm } from "./crm-form";
import type { CrmCustomer } from "@/lib/types";
import * as React from "react";

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

interface CustomerDetailHeaderProps {
  customer: CrmCustomer;
}

export function CustomerDetailHeader({ customer }: CustomerDetailHeaderProps) {
  const [formOpen, setFormOpen] = React.useState(false);
  const status = statusConfig[customer.status] ?? {
    label: customer.status,
    className: "",
  };
  const googleDriveUrl = (customer as unknown as Record<string, unknown>)
    .google_drive_url as string | undefined;

  return (
    <>
      <Link
        href="/crm"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to CRM
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className={status.className}>
              {status.label}
            </Badge>
            {customer.industry && (
              <Badge variant="outline">{customer.industry}</Badge>
            )}
            {customer.website && (
              <a
                href={customer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {customer.website
                  .replace(/^https?:\/\/(www\.)?/, "")
                  .replace(/\/$/, "")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {customer.primary_contact && (
            <p className="text-sm text-muted-foreground">
              Primary: {customer.primary_contact}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {googleDriveUrl && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={googleDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Drive
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <CrmForm open={formOpen} onOpenChange={setFormOpen} customer={customer} />
    </>
  );
}
