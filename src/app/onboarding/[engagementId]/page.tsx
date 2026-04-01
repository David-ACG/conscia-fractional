import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { QuestionnaireForm } from "@/components/engagement/questionnaire-form";
import { generateQuestionnaire } from "@/lib/actions/questionnaire";
import type { EngagementQuestionnaire } from "@/lib/types";

interface OnboardingPageProps {
  params: Promise<{ engagementId: string }>;
}

async function getOnboardingData(engagementId: string) {
  const supabase = createClient();
  if (!supabase) return { questionnaire: null, questions: [] };

  const { data: questionnaire } = await supabase
    .from("engagement_questionnaires")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!questionnaire) return { questionnaire: null, questions: [] };

  const typedQ = questionnaire as unknown as EngagementQuestionnaire;
  const contractData = (typedQ.contract_data ?? {}) as Record<string, unknown>;
  const questions = generateQuestionnaire(contractData);

  return { questionnaire: typedQ, questions };
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { engagementId } = await params;
  const { questionnaire, questions } = await getOnboardingData(engagementId);

  if (!questionnaire) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold">Questionnaire Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          This questionnaire link may be invalid or expired.
        </p>
      </div>
    );
  }

  const isCompleted =
    questionnaire.status === "completed" || questionnaire.status === "reviewed";

  return (
    <div className="animate-in">
      <h2 className="text-xl font-bold">Ways of Working</h2>
      <p className="mt-1 text-muted-foreground">
        {isCompleted
          ? "Thank you! Your answers have been submitted."
          : "Please fill in the questions below to help us work together effectively."}
      </p>

      <div className="mt-6">
        <QuestionnaireForm
          questionnaire={questionnaire}
          questions={questions}
          readOnly={isCompleted}
        />
      </div>
    </div>
  );
}
