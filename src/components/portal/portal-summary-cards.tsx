import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export interface SummaryCardData {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
}

interface PortalSummaryCardsProps {
  cards: SummaryCardData[];
}

export function PortalSummaryCards({ cards }: PortalSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const content = (
          <Card
            key={card.label}
            className={
              card.href ? "transition-colors hover:border-primary/30" : ""
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {card.label}
              </CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        );

        if (card.href) {
          return (
            <Link key={card.label} href={card.href} className="block">
              {content}
            </Link>
          );
        }

        return <div key={card.label}>{content}</div>;
      })}
    </div>
  );
}
