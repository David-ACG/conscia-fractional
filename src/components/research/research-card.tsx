"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Research } from "@/lib/types";

const researchTypeConfig: Record<string, { label: string; className: string }> =
  {
    architecture: {
      label: "Architecture",
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    },
    competitor: {
      label: "Competitor",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    },
    technology: {
      label: "Technology",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    market: {
      label: "Market",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    other: {
      label: "Other",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    },
  };

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/^[-*+]\s/gm, "")
    .replace(/^>\s/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

interface ResearchCardProps {
  research: Research;
  onClick: (research: Research) => void;
}

export function ResearchCard({ research, onClick }: ResearchCardProps) {
  const typeInfo =
    researchTypeConfig[research.research_type] ?? researchTypeConfig.other;

  const preview = research.content
    ? stripMarkdown(research.content).slice(0, 200)
    : null;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onClick(research)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold truncate">{research.title}</h3>
          <Badge
            variant="secondary"
            className={`shrink-0 ${typeInfo.className}`}
          >
            {typeInfo.label}
          </Badge>
        </div>

        {preview && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
            {preview}
            {(research.content?.length ?? 0) > 200 ? "..." : ""}
          </p>
        )}

        {Array.isArray(research.tags) && research.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {research.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {new Date(research.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
