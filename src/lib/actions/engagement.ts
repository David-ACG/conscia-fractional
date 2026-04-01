"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import {
  scopeCreepSchema,
  type ScopeCreepFormData,
} from "@/lib/validations/engagement";

// ─── Contract extraction via Gemini ─────────────────────────────────

export interface ContractExtraction {
  client_name: string | null;
  role: string | null;
  day_rate: number | null;
  hourly_rate: number | null;
  hours_per_week: number | null;
  billing_frequency: string | null;
  payment_terms: string | null;
  start_date: string | null;
  end_date: string | null;
  scope: string[];
  out_of_scope: string[];
  end_clients: string[];
  termination_clauses: string[];
  key_contacts: string[];
  working_hours: string | null;
  timezone: string | null;
  tools: string[];
  meetings: string[];
}

export async function extractContractData(
  pdfBase64: string,
  mimeType: string = "application/pdf",
): Promise<{ data?: ContractExtraction; error?: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      error: "GOOGLE_GEMINI_API_KEY not configured. Add it to .env.local",
    };
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Extract structured data from this contract/engagement document. Return ONLY valid JSON with these fields (use null for missing values, empty arrays for missing lists):

{
  "client_name": "string or null",
  "role": "string or null",
  "day_rate": number or null,
  "hourly_rate": number or null,
  "hours_per_week": number or null,
  "billing_frequency": "string or null",
  "payment_terms": "string or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "scope": ["array of in-scope items"],
  "out_of_scope": ["array of out-of-scope items"],
  "end_clients": ["array of end client/customer names"],
  "termination_clauses": ["array of termination clause summaries"],
  "key_contacts": ["array of contact names mentioned"],
  "working_hours": "string or null",
  "timezone": "string or null",
  "tools": ["array of tools/platforms mentioned"],
  "meetings": ["array of recurring meetings mentioned"]
}

Return ONLY the JSON object, no markdown fences.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: pdfBase64,
          mimeType,
        },
      },
    ]);

    const text = result.response.text().trim();
    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonStr) as ContractExtraction;

    return { data: parsed };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during extraction";
    return { error: message };
  }
}

export async function saveContractData(
  engagementId: string,
  extraction: ContractExtraction,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const update: Record<string, unknown> = {
    contract_data: extraction,
  };

  // Also update direct fields if extracted
  if (extraction.day_rate) update.day_rate_gbp = extraction.day_rate;
  if (extraction.hourly_rate) update.hourly_rate_gbp = extraction.hourly_rate;
  if (extraction.hours_per_week)
    update.hours_per_week = extraction.hours_per_week;
  if (extraction.billing_frequency)
    update.billing_frequency = extraction.billing_frequency;
  if (extraction.payment_terms) update.payment_terms = extraction.payment_terms;
  if (extraction.start_date) update.start_date = extraction.start_date;
  if (extraction.end_date) update.end_date = extraction.end_date;
  if (extraction.scope?.length) update.scope = extraction.scope;
  if (extraction.out_of_scope?.length)
    update.out_of_scope = extraction.out_of_scope;
  if (extraction.role) update.role_title = extraction.role;

  const { error } = await supabase
    .from("engagements")
    .update(update)
    .eq("id", engagementId);

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true };
}

// ─── Scope management ───────────────────────────────────────────────

export async function updateScope(
  engagementId: string,
  scope: string[],
  outOfScope: string[],
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("engagements")
    .update({ scope, out_of_scope: outOfScope })
    .eq("id", engagementId);

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true };
}

// ─── Scope creep CRUD ───────────────────────────────────────────────

export async function createScopeCreepEntry(
  engagementId: string,
  clientId: string,
  data: ScopeCreepFormData,
) {
  const parsed = scopeCreepSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid form data" };

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("scope_creep_log").insert({
    engagement_id: engagementId,
    client_id: clientId,
    description: parsed.data.description,
    requested_by: parsed.data.requested_by || null,
    requested_date:
      parsed.data.requested_date || new Date().toISOString().slice(0, 10),
    status: parsed.data.status,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true };
}

export async function updateScopeCreepStatus(
  entryId: string,
  status: "logged" | "discussed" | "accepted" | "declined",
  notes?: string,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const update: Record<string, unknown> = { status };
  if (notes !== undefined) update.notes = notes;

  const { error } = await supabase
    .from("scope_creep_log")
    .update(update)
    .eq("id", entryId);

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true };
}

export async function deleteScopeCreepEntry(entryId: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("scope_creep_log")
    .delete()
    .eq("id", entryId);

  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { success: true };
}
