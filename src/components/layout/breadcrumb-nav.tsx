"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";

const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  timesheet: "Timesheet",
  tasks: "Tasks",
  meetings: "Meetings",
  contacts: "Contacts",
  crm: "CRM",
  engagement: "Engagement",
  research: "Research",
  notes: "Notes",
  assets: "Assets",
  deliverables: "Deliverables",
  invoicing: "Invoicing",
  portal: "Client Portal",
  timer: "Timer",
};

export function BreadcrumbNav() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter((s) => s && !s.startsWith("("));

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          const label =
            segmentLabels[segment] ??
            segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <React.Fragment key={href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
