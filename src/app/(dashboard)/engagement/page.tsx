import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { ContractTerms } from "@/components/engagement/contract-terms";
import { ScopeCard } from "@/components/engagement/scope-card";
import { WaysOfWorkingCard } from "@/components/engagement/ways-of-working-card";
import { ContractUpload } from "@/components/engagement/contract-upload";
import { ScopeCreepLog } from "@/components/engagement/scope-creep-log";
import type {
  Engagement,
  Client,
  EngagementQuestionnaire,
  ScopeCreepEntry,
} from "@/lib/types";

async function getEngagementData() {
  const clientId = await getActiveClientId();
  const supabase = createClient();

  if (!supabase || !clientId) {
    return { engagement: null, questionnaire: null, scopeCreepEntries: [] };
  }

  const { data: engagementData } = await supabase
    .from("engagements")
    .select("*, client:clients(*)")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!engagementData) {
    return { engagement: null, questionnaire: null, scopeCreepEntries: [] };
  }

  const engagement = engagementData as unknown as Engagement & {
    client: Client;
  };

  const [questionnaireRes, scopeCreepRes] = await Promise.all([
    supabase
      .from("engagement_questionnaires")
      .select("*")
      .eq("engagement_id", engagement.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("scope_creep_log")
      .select("*")
      .eq("engagement_id", engagement.id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    engagement,
    questionnaire: (questionnaireRes.data ??
      null) as EngagementQuestionnaire | null,
    scopeCreepEntries: (scopeCreepRes.data ?? []) as ScopeCreepEntry[],
  };
}

export default async function EngagementPage() {
  const { engagement, questionnaire, scopeCreepEntries } =
    await getEngagementData();

  if (!engagement) {
    return (
      <div className="animate-in">
        <h1 className="text-2xl font-bold tracking-tight">Engagement</h1>
        <p className="mt-2 text-muted-foreground">
          No active engagement found. Connect to Supabase to load data.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Engagement</h1>
      <p className="mt-1 text-muted-foreground">
        {engagement.client?.name ?? "Client"} — {engagement.role_title}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <ContractTerms engagement={engagement} />
          <ScopeCard
            engagementId={engagement.id}
            scope={engagement.scope}
            outOfScope={engagement.out_of_scope}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <WaysOfWorkingCard
            engagementId={engagement.id}
            clientId={engagement.client_id}
            questionnaire={questionnaire}
          />
          <ContractUpload engagementId={engagement.id} />
          <ScopeCreepLog
            engagementId={engagement.id}
            clientId={engagement.client_id}
            entries={scopeCreepEntries}
          />
        </div>
      </div>
    </div>
  );
}
