"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getLinkedFolders(crmCustomerId: string) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { data, error } = await supabase
    .from("crm_drive_folders")
    .select("*, integrations(account_identifier)")
    .eq("crm_customer_id", crmCustomerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function unlinkFolder(folderId: string) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { error } = await supabase
    .from("crm_drive_folders")
    .delete()
    .eq("id", folderId);

  if (error) throw error;
}
