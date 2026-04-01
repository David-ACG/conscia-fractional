import { Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Engagement, Client } from "@/lib/types";

interface EngagementCardProps {
  engagement: (Engagement & { client?: Client }) | null;
}

export function EngagementCard({ engagement }: EngagementCardProps) {
  if (!engagement) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Engagement</CardTitle>
          <Briefcase className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active engagement</p>
        </CardContent>
      </Card>
    );
  }

  const statusVariant =
    engagement.status === "active" ? "default" : "secondary";

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Engagement</CardTitle>
        <Briefcase className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {engagement.client?.name ?? "Client"}
          </h3>
          <Badge variant={statusVariant} className="capitalize">
            {engagement.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {engagement.role_title}
        </p>
        <div className="mt-3 space-y-1 text-sm">
          {engagement.hourly_rate_gbp && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-medium">
                £{engagement.hourly_rate_gbp}/hr
              </span>
            </div>
          )}
          {engagement.day_rate_gbp && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Day rate</span>
              <span className="font-medium">
                £{engagement.day_rate_gbp}/day
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hours/week</span>
            <span className="font-medium">{engagement.hours_per_week}h</span>
          </div>
          {engagement.billing_frequency && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing</span>
              <span className="font-medium capitalize">
                {engagement.billing_frequency}
              </span>
            </div>
          )}
        </div>
        {engagement.scope.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Scope
            </p>
            <ul className="mt-1 space-y-0.5">
              {engagement.scope.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
