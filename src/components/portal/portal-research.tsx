import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalEmptyState } from "./portal-empty-state";
import { Search, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

interface PortalResearchProps {
  clientId: string;
}

const researchTypeVariant: Record<string, "default" | "secondary" | "outline"> =
  {
    architecture: "default",
    competitor: "default",
    technology: "secondary",
    market: "outline",
    other: "outline",
  };

export async function PortalResearch({ clientId }: PortalResearchProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: research } = await admin
    .from("research")
    .select("id, title, content, research_type, tags, created_at")
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  if (!research || research.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Research</h1>
        <PortalEmptyState
          icon={<Search className="size-10" />}
          title="No research shared yet"
          description="Research items will appear here once they are shared with you."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Research</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {research.map((item) => (
          <details key={item.id} className="group">
            <summary className="cursor-pointer list-none">
              <Card className="h-full transition-colors group-open:border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {item.title}
                    </CardTitle>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        researchTypeVariant[item.research_type] ?? "outline"
                      }
                    >
                      {item.research_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "d MMM yyyy")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {item.content
                      ? item.content.replace(/[#*_`>\-\[\]]/g, "").slice(0, 200)
                      : "No content."}
                  </p>
                  {(item.tags as string[])?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(item.tags as string[]).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </summary>

            <Card className="mt-2 border-l-4 border-l-primary/30">
              <CardContent className="py-4">
                {item.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{item.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No content.
                  </p>
                )}
              </CardContent>
            </Card>
          </details>
        ))}
      </div>
    </div>
  );
}
