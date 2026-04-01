import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { QuestionnaireForm } from "@/components/engagement/questionnaire-form";
import { generateQuestionnaire } from "@/lib/actions/questionnaire";
import type { EngagementQuestionnaire, Engagement } from "@/lib/types";
import type { QuestionDef } from "@/lib/actions/questionnaire";

async function getQuestionnaireData() {
  const supabase = createClient();
  if (!supabase) return { questionnaire: null, questions: [] };

  const { data: engagement } = await supabase
    .from("engagements")
    .select("*")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!engagement) return { questionnaire: null, questions: [] };

  const typed = engagement as unknown as Engagement;

  const { data: questionnaire } = await supabase
    .from("engagement_questionnaires")
    .select("*")
    .eq("engagement_id", typed.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!questionnaire) return { questionnaire: null, questions: [] };

  const typedQ = questionnaire as unknown as EngagementQuestionnaire;
  const contractData = (typedQ.contract_data ?? {}) as Record<string, unknown>;
  const questions = generateQuestionnaire(contractData);

  return { questionnaire: typedQ, questions };
}

export default async function QuestionnairePage() {
  const { questionnaire, questions } = await getQuestionnaireData();

  if (!questionnaire) {
    return (
      <div className="animate-in">
        <h1 className="text-2xl font-bold tracking-tight">Questionnaire</h1>
        <p className="mt-2 text-muted-foreground">
          No questionnaire found. Create one from the Engagement page first.
        </p>
      </div>
    );
  }

  const isCompleted =
    questionnaire.status === "completed" || questionnaire.status === "reviewed";

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">
        Ways of Working Questionnaire
      </h1>
      <p className="mt-1 text-muted-foreground">
        {isCompleted
          ? "Answers submitted. Review below."
          : "Fill in the questions below. Progress is saved automatically."}
      </p>

      <div className="mt-6 mx-auto max-w-2xl">
        <QuestionnaireForm
          questionnaire={questionnaire}
          questions={questions}
          readOnly={isCompleted}
        />
      </div>
    </div>
  );
}
