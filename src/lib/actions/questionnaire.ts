"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import type { Engagement } from "@/lib/types";

// ─── Question bank ──────────────────────────────────────────────────
export interface QuestionDef {
  id: string;
  category: string;
  question: string;
  type: "text" | "textarea" | "select" | "multiselect" | "toggle";
  required: boolean;
  options?: string[];
}

const FULL_QUESTION_BANK: QuestionDef[] = [
  // Communication & Availability
  {
    id: "core_working_hours",
    category: "Communication & Availability",
    question: "What are your team's core working hours?",
    type: "text",
    required: true,
  },
  {
    id: "urgent_contact",
    category: "Communication & Availability",
    question:
      "What's the preferred way to reach you for urgent vs non-urgent matters?",
    type: "textarea",
    required: true,
  },
  {
    id: "response_time",
    category: "Communication & Availability",
    question: "How quickly do you expect responses to messages?",
    type: "select",
    required: true,
    options: [
      "Within 1 hour",
      "Within 2-4 hours",
      "Same business day",
      "Next business day",
    ],
  },
  {
    id: "no_meeting_days",
    category: "Communication & Availability",
    question: "Are there any regular no-meeting days or focus blocks?",
    type: "text",
    required: false,
  },
  {
    id: "timezone",
    category: "Communication & Availability",
    question: "What timezone(s) does the team operate in?",
    type: "text",
    required: true,
  },

  // Meetings & Cadence
  {
    id: "recurring_meetings",
    category: "Meetings & Cadence",
    question:
      "Which recurring meetings should I attend? (name, frequency, day/time)",
    type: "textarea",
    required: true,
  },
  {
    id: "meeting_recordings",
    category: "Meetings & Cadence",
    question: "Are meetings recorded? If so, where are recordings stored?",
    type: "text",
    required: false,
  },
  {
    id: "meeting_notes_expectation",
    category: "Meetings & Cadence",
    question: "What's the expectation for meeting notes/minutes?",
    type: "select",
    required: false,
    options: [
      "Not expected",
      "Brief summary only",
      "Detailed minutes",
      "Action items only",
    ],
  },
  {
    id: "meeting_runners",
    category: "Meetings & Cadence",
    question: "Who runs the meetings I'll attend?",
    type: "text",
    required: false,
  },
  {
    id: "standup",
    category: "Meetings & Cadence",
    question: "Is there a stand-up or check-in I should join?",
    type: "text",
    required: false,
  },

  // Tools & Templates
  {
    id: "document_templates",
    category: "Tools & Templates",
    question:
      "What document templates should I use? (docs, slides, spreadsheets, diagrams)",
    type: "textarea",
    required: false,
  },
  {
    id: "file_sharing",
    category: "Tools & Templates",
    question:
      "Where should I store/share deliverables? (SharePoint, Google Drive, Confluence, etc.)",
    type: "text",
    required: true,
  },
  {
    id: "diagram_tool",
    category: "Tools & Templates",
    question:
      "Do you have a diagram tool preference? (Miro, Lucidchart, draw.io, etc.)",
    type: "text",
    required: false,
  },
  {
    id: "code_repo",
    category: "Tools & Templates",
    question:
      "Is there a code repository / architecture repo I should know about?",
    type: "text",
    required: false,
  },
  {
    id: "style_guides",
    category: "Tools & Templates",
    question:
      "Are there style guides, brand guidelines, or naming conventions?",
    type: "text",
    required: false,
  },

  // Decision Making & Approvals
  {
    id: "decision_approver",
    category: "Decision Making & Approvals",
    question: "Who approves architectural decisions?",
    type: "text",
    required: true,
  },
  {
    id: "adr_process",
    category: "Decision Making & Approvals",
    question: "Is there an ADR (Architecture Decision Record) process?",
    type: "select",
    required: false,
    options: ["Yes — formal process", "Informal / ad-hoc", "No", "Not sure"],
  },
  {
    id: "priority_setting",
    category: "Decision Making & Approvals",
    question: "How are priorities set? Who decides what I work on day-to-day?",
    type: "textarea",
    required: true,
  },
  {
    id: "change_process",
    category: "Decision Making & Approvals",
    question: "What's the change/release process?",
    type: "textarea",
    required: false,
  },

  // Team & Culture
  {
    id: "key_people",
    category: "Team & Culture",
    question:
      "Who are the key people I'll work with most? (name, role, best contact)",
    type: "textarea",
    required: true,
  },
  {
    id: "org_chart",
    category: "Team & Culture",
    question: "Is there an org chart or team structure doc?",
    type: "text",
    required: false,
  },
  {
    id: "team_norms",
    category: "Team & Culture",
    question:
      "Are there any team norms I should know about? (camera on/off, async-first, etc.)",
    type: "textarea",
    required: false,
  },
  {
    id: "escalation",
    category: "Team & Culture",
    question: "How does the team handle disagreements or blocking issues?",
    type: "textarea",
    required: false,
  },

  // Onboarding & Access
  {
    id: "system_access",
    category: "Onboarding & Access",
    question:
      "What systems/tools do I need access to? (with links if possible)",
    type: "textarea",
    required: true,
  },
  {
    id: "onboarding_docs",
    category: "Onboarding & Access",
    question: "Is there onboarding documentation or a wiki I should read?",
    type: "text",
    required: false,
  },
  {
    id: "it_contact",
    category: "Onboarding & Access",
    question: "Who handles IT/access provisioning?",
    type: "text",
    required: false,
  },
  {
    id: "compliance_training",
    category: "Onboarding & Access",
    question: "Are there any compliance/security training requirements?",
    type: "text",
    required: false,
  },
];

export async function getFullQuestionBank(): Promise<QuestionDef[]> {
  return FULL_QUESTION_BANK;
}

// Keys in contract_data that map to question IDs
const CONTRACT_TO_QUESTION_MAP: Record<string, string[]> = {
  client_name: [],
  role: [],
  rates: [],
  hours: [],
  scope: [],
  payment_terms: [],
  key_contacts: ["key_people"],
  working_hours: ["core_working_hours"],
  timezone: ["timezone"],
  tools: ["file_sharing", "diagram_tool", "code_repo"],
  meetings: ["recurring_meetings", "standup"],
};

export async function generateQuestionnaire(
  contractData: Record<string, unknown> = {},
): QuestionDef[] {
  const answeredIds = new Set<string>();

  for (const [key, questionIds] of Object.entries(CONTRACT_TO_QUESTION_MAP)) {
    const val = contractData[key];
    const hasValue = Array.isArray(val) ? val.length > 0 : Boolean(val);
    if (hasValue && questionIds.length > 0) {
      for (const qId of questionIds) {
        answeredIds.add(qId);
      }
    }
  }

  return FULL_QUESTION_BANK.filter((q) => !answeredIds.has(q.id));
}

export async function getQuestionCategories(
  questions: QuestionDef[],
): Promise<string[]> {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const q of questions) {
    if (!seen.has(q.category)) {
      seen.add(q.category);
      categories.push(q.category);
    }
  }
  return categories;
}

// ─── Server actions ─────────────────────────────────────────────────

export async function createQuestionnaire(
  engagementId: string,
  clientId: string,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  // Get engagement for contract data
  const { data: engagement } = await supabase
    .from("engagements")
    .select("contract_data")
    .eq("id", engagementId)
    .single();

  const contractData = (engagement?.contract_data ?? {}) as Record<
    string,
    unknown
  >;
  const questions = generateQuestionnaire(contractData);

  const { data, error } = await supabase
    .from("engagement_questionnaires")
    .insert({
      engagement_id: engagementId,
      client_id: clientId,
      status: "draft",
      contract_data: contractData,
      questions,
      answers: {},
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true, questionnaire: data };
}

export async function sendQuestionnaire(
  questionnaireId: string,
  email: string,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("engagement_questionnaires")
    .update({
      status: "sent",
      sent_to_email: email,
      sent_at: new Date().toISOString(),
    })
    .eq("id", questionnaireId);

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true };
}

export async function saveQuestionnaireAnswers(
  questionnaireId: string,
  answers: Record<string, unknown>,
  isComplete: boolean,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const update: Record<string, unknown> = {
    answers,
    status: isComplete ? "completed" : "partial",
  };
  if (isComplete) {
    update.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("engagement_questionnaires")
    .update(update)
    .eq("id", questionnaireId);

  if (error) return { error: error.message };

  // Auto-populate other modules if completed
  if (isComplete) {
    await processQuestionnaireAnswers(questionnaireId);
  }

  revalidatePath("/engagement");
  revalidatePath("/engagement/questionnaire");
  return { success: true };
}

async function processQuestionnaireAnswers(questionnaireId: string) {
  const supabase = createClient();
  if (!supabase) return;

  const { data: questionnaire } = await supabase
    .from("engagement_questionnaires")
    .select("*, engagement:engagements(*)")
    .eq("id", questionnaireId)
    .single();

  if (!questionnaire) return;

  const answers = questionnaire.answers as Record<string, unknown>;
  const clientId = questionnaire.client_id;

  // key_people → create contacts
  if (
    answers.key_people &&
    typeof answers.key_people === "string" &&
    answers.key_people.trim()
  ) {
    const lines = (answers.key_people as string)
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      const parts = line.split(/[,\-–]/).map((p) => p.trim());
      const name = parts[0] ?? line.trim();
      const role = parts[1] ?? null;
      if (name) {
        await supabase.from("contacts").insert({
          client_id: clientId,
          name,
          role,
          preferred_contact_method: "email",
          skills: [],
        });
      }
    }
  }

  // system_access → create tasks
  if (
    answers.system_access &&
    typeof answers.system_access === "string" &&
    answers.system_access.trim()
  ) {
    const lines = (answers.system_access as string)
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      await supabase.from("tasks").insert({
        client_id: clientId,
        title: `Get access to: ${line.trim()}`,
        status: "todo",
        priority: "high",
        assignee_type: "self",
      });
    }
  }

  // document_templates → create assets
  if (
    answers.document_templates &&
    typeof answers.document_templates === "string" &&
    answers.document_templates.trim()
  ) {
    const lines = (answers.document_templates as string)
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      await supabase.from("assets").insert({
        client_id: clientId,
        name: line.trim(),
        asset_type: "template",
      });
    }
  }

  // core_working_hours → update engagement notes
  if (
    answers.core_working_hours &&
    typeof answers.core_working_hours === "string"
  ) {
    const engagement = questionnaire.engagement as Engagement | null;
    if (engagement) {
      const existingData = (engagement.contract_data ?? {}) as Record<
        string,
        unknown
      >;
      await supabase
        .from("engagements")
        .update({
          contract_data: {
            ...existingData,
            working_hours: answers.core_working_hours,
          },
        })
        .eq("id", engagement.id);
    }
  }

  // recurring_meetings → create notes as placeholder meeting entries
  if (
    answers.recurring_meetings &&
    typeof answers.recurring_meetings === "string" &&
    answers.recurring_meetings.trim()
  ) {
    await supabase.from("notes").insert({
      client_id: clientId,
      title: "Recurring Meetings (from questionnaire)",
      content: answers.recurring_meetings as string,
      note_type: "context",
      tags: ["onboarding", "meetings"],
    });
  }

  revalidatePath("/contacts");
  revalidatePath("/tasks");
  revalidatePath("/assets");
}

export async function getQuestionnaireByEngagement(engagementId: string) {
  const supabase = createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("engagement_questionnaires")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data;
}
