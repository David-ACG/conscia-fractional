"use client";

import { format } from "date-fns";
import {
  Briefcase,
  Calendar,
  Clock,
  CreditCard,
  PoundSterling,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Engagement, Client } from "@/lib/types";

interface ContractTermsProps {
  engagement: Engagement & { client?: Client };
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400",
  paused: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  completed: "bg-muted text-muted-foreground",
};

export function ContractTerms({ engagement }: ContractTermsProps) {
  const clientName = engagement.client?.name ?? "—";
  const dayRate = engagement.day_rate_gbp
    ? `£${Number(engagement.day_rate_gbp).toLocaleString()}`
    : "—";
  const hourlyRate = engagement.hourly_rate_gbp
    ? `£${Number(engagement.hourly_rate_gbp).toFixed(2)}`
    : "—";
  const endDate = engagement.end_date
    ? format(new Date(engagement.end_date), "d MMM yyyy")
    : "Ongoing";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">
          Contract Terms
        </CardTitle>
        <Badge className={statusColors[engagement.status] ?? ""}>
          {engagement.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row icon={Briefcase} label="Client" value={clientName} />
        <Row icon={Briefcase} label="Role" value={engagement.role_title} />
        <Row icon={PoundSterling} label="Day rate" value={dayRate} />
        <Row icon={PoundSterling} label="Hourly rate" value={hourlyRate} />
        <Row
          icon={Clock}
          label="Hours / week"
          value={String(engagement.hours_per_week)}
        />
        <Row
          icon={CreditCard}
          label="Billing"
          value={engagement.billing_frequency ?? "—"}
        />
        <Row
          icon={CreditCard}
          label="Payment terms"
          value={engagement.payment_terms ?? "—"}
        />
        <Row
          icon={Calendar}
          label="Start"
          value={
            engagement.start_date
              ? format(new Date(engagement.start_date), "d MMM yyyy")
              : "—"
          }
        />
        <Row icon={Calendar} label="End" value={endDate} />
      </CardContent>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-auto text-right font-medium">{value}</span>
    </div>
  );
}
