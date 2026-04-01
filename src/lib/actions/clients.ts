"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient as createClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "fb_client_id";

// ─── Cookie-based active client ─────────────────────────────────────

export async function setActiveClient(clientId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, clientId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });
  revalidatePath("/");
}

export async function getActiveClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(COOKIE_NAME)?.value;
  if (stored) return stored;

  // Fallback: first active engagement's client_id
  const supabase = createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("engagements")
    .select("client_id")
    .eq("status", "active")
    .limit(1)
    .single();

  return data?.client_id ?? null;
}

// ─── Client queries ─────────────────────────────────────────────────

export async function getClients() {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("clients")
    .select("id, name, slug, industry")
    .order("name");

  return data ?? [];
}

export async function getActiveEngagement(clientId: string) {
  const supabase = createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("engagements")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .single();

  return data ?? null;
}

// ─── Slug generation ────────────────────────────────────────────────

export async function generateSlug(name: string): Promise<string> {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Create client + engagement ─────────────────────────────────────

interface CreateClientData {
  name: string;
  industry?: string;
  website?: string;
  linkedin_url?: string;
  role_title: string;
  day_rate_gbp?: number;
  hourly_rate_gbp?: number;
  hours_per_week?: number;
  billing_frequency?: string;
}

export async function createClientWithEngagement(data: CreateClientData) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const slug = await generateSlug(data.name);

  // Insert client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      name: data.name,
      slug,
      industry: data.industry || null,
      website: data.website || null,
      linkedin_url: data.linkedin_url || null,
    })
    .select("id")
    .single();

  if (clientError) return { error: clientError.message };

  // Insert engagement
  const { error: engError } = await supabase.from("engagements").insert({
    client_id: client.id,
    role_title: data.role_title,
    day_rate_gbp: data.day_rate_gbp || null,
    hourly_rate_gbp: data.hourly_rate_gbp || null,
    hours_per_week: data.hours_per_week || null,
    billing_frequency: data.billing_frequency || null,
    status: "active",
  });

  if (engError) return { error: engError.message };

  revalidatePath("/dashboard");
  return { success: true, clientId: client.id };
}
