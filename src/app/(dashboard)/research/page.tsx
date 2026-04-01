import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { ResearchList } from "@/components/research/research-list";
import type { Research } from "@/lib/types";

async function getResearchData() {
  const clientId = await getActiveClientId();
  const supabase = createClient();

  if (!supabase || !clientId) {
    return { items: [], allTags: [] };
  }

  const { data: items } = await supabase
    .from("research")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const typedItems = (items ?? []) as Research[];

  const allTags = new Set<string>();
  for (const item of typedItems) {
    for (const tag of item.tags ?? []) {
      allTags.add(tag);
    }
  }

  return {
    items: typedItems,
    allTags: Array.from(allTags).sort(),
  };
}

export default async function ResearchPage() {
  const { items, allTags } = await getResearchData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Research</h1>
      <p className="mt-1 text-muted-foreground">
        Research notes and findings for your client engagements.
      </p>

      <div className="mt-6">
        <ResearchList items={items} allTags={allTags} />
      </div>
    </div>
  );
}
