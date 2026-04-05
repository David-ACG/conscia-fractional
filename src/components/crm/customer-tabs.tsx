"use client";

import * as React from "react";
import {
  HardDrive,
  MessageSquare,
  Mail,
  MessageCircleQuestion,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetCard } from "@/components/assets/asset-card";
import { BulkLinkAssets } from "@/components/crm/bulk-link-assets";
import { DriveFilesTab } from "@/components/crm/drive-files-tab";
import { SlackMessagesTab } from "@/components/crm/slack-messages-tab";
import { EmailTab } from "@/components/crm/email-tab";
import { DocumentChat } from "@/components/crm/document-chat";
import type {
  CrmCustomer,
  Meeting,
  Task,
  TimeEntry,
  Asset,
  Deliverable,
} from "@/lib/types";

// --- Status configs (matching existing conventions) ---

const taskStatusConfig: Record<string, { label: string; className: string }> = {
  todo: {
    label: "To Do",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  blocked: {
    label: "Blocked",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  done: {
    label: "Done",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: {
    label: "Low",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  medium: {
    label: "Medium",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  high: {
    label: "High",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

const platformConfig: Record<string, { label: string; className: string }> = {
  zoom: {
    label: "Zoom",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  teams: {
    label: "Teams",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  meet: {
    label: "Meet",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

const deliverableStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  review: {
    label: "Review",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

// --- Helpers ---

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// --- Props ---

interface CustomerTabsProps {
  customer: CrmCustomer;
  meetings: Meeting[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  assets: Asset[];
  unlinkedTextMatchedAssets?: Asset[];
  deliverables: Deliverable[];
}

// --- Component ---

export function CustomerTabs({
  customer,
  meetings,
  tasks,
  timeEntries,
  assets,
  unlinkedTextMatchedAssets = [],
  deliverables,
}: CustomerTabsProps) {
  const totalMinutes = timeEntries.reduce(
    (sum, e) => sum + (e.duration_minutes ?? 0),
    0,
  );

  return (
    <Tabs defaultValue="meetings">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="meetings">Meetings ({meetings.length})</TabsTrigger>
        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        <TabsTrigger value="timesheet">
          Timesheet ({timeEntries.length})
        </TabsTrigger>
        <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
        <TabsTrigger value="deliverables">
          Deliverables ({deliverables.length})
        </TabsTrigger>
        <TabsTrigger value="drive" className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" />
          Drive
        </TabsTrigger>
        <TabsTrigger value="slack" className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Slack
        </TabsTrigger>
        <TabsTrigger value="email" className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          Email
        </TabsTrigger>
        <TabsTrigger value="ask" className="flex items-center gap-1.5">
          <MessageCircleQuestion className="h-3.5 w-3.5" />
          Ask
        </TabsTrigger>
      </TabsList>

      {/* Meetings Tab */}
      <TabsContent value="meetings">
        {meetings.length === 0 ? (
          <EmptyState>No meetings with {customer.name} yet.</EmptyState>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-center">Attendees</TableHead>
                  <TableHead>Platform</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(meeting.meeting_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {meeting.title}
                    </TableCell>
                    <TableCell>
                      {formatDuration(meeting.duration_minutes)}
                    </TableCell>
                    <TableCell className="text-center">
                      {meeting.attendees?.length ?? 0}
                    </TableCell>
                    <TableCell>
                      {meeting.platform ? (
                        <Badge
                          variant="secondary"
                          className={
                            platformConfig[meeting.platform]?.className
                          }
                        >
                          {platformConfig[meeting.platform]?.label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Tasks Tab */}
      <TabsContent value="tasks">
        {tasks.length === 0 ? (
          <EmptyState>No tasks for {customer.name} yet.</EmptyState>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const priority = priorityConfig[task.priority] ?? {
                    label: task.priority,
                    className: "",
                  };
                  const status = taskStatusConfig[task.status] ?? {
                    label: task.status,
                    className: "",
                  };
                  const isOverdue =
                    task.due_date &&
                    task.status !== "done" &&
                    new Date(task.due_date) < new Date();
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={priority.className}
                        >
                          {priority.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {task.title}
                      </TableCell>
                      <TableCell>{task.assignee || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={
                            isOverdue ? "text-red-600 dark:text-red-400" : ""
                          }
                        >
                          {formatDate(task.due_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Timesheet Tab */}
      <TabsContent value="timesheet">
        {timeEntries.length === 0 ? (
          <EmptyState>No time logged for {customer.name} yet.</EmptyState>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Billable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(entry.started_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.description || "—"}
                    </TableCell>
                    <TableCell>
                      {formatDuration(entry.duration_minutes)}
                    </TableCell>
                    <TableCell>
                      {entry.is_billable ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        >
                          Billable
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3} className="text-right">
                    Total
                  </TableCell>
                  <TableCell>{formatDuration(totalMinutes)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Assets Tab */}
      <TabsContent value="assets">
        <div className="space-y-4">
          <BulkLinkAssets
            unlinkedAssets={unlinkedTextMatchedAssets}
            customerId={customer.id}
            customerName={customer.name}
          />
          {assets.length === 0 ? (
            <EmptyState>No assets for {customer.name} yet.</EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => {
                    if (asset.file_url) {
                      window.open(
                        asset.file_url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Deliverables Tab */}
      <TabsContent value="deliverables">
        {deliverables.length === 0 ? (
          <EmptyState>No deliverables for {customer.name} yet.</EmptyState>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverables.map((d) => {
                  const status = deliverableStatusConfig[d.status] ?? {
                    label: d.status,
                    className: "",
                  };
                  const isOverdue =
                    d.due_date &&
                    d.status !== "delivered" &&
                    new Date(d.due_date) < new Date();
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            isOverdue ? "text-red-600 dark:text-red-400" : ""
                          }
                        >
                          {formatDate(d.due_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{d.version}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Drive Tab */}
      <TabsContent value="drive">
        <DriveFilesTab
          crmCustomerId={customer.id}
          crmCustomerName={customer.name}
        />
      </TabsContent>

      {/* Slack Tab */}
      <TabsContent value="slack">
        <SlackMessagesTab customerId={customer.id} />
      </TabsContent>

      {/* Email Tab */}
      <TabsContent value="email">
        <EmailTab customerId={customer.id} />
      </TabsContent>

      {/* Ask Tab */}
      <TabsContent value="ask">
        <DocumentChat customerId={customer.id} customerName={customer.name} />
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
