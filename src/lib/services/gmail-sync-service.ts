import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/services/google-auth-service";
import { getGmailClient, listMessages } from "@/lib/services/gmail-service";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export interface NewEmailNotification {
  subject: string;
  from: string;
  date: string;
  messageId: string;
  crmCustomerId: string;
  crmCustomerName: string;
}

export async function checkNewEmails(
  integrationId: string,
): Promise<NewEmailNotification[]> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  // 1. Fetch integration record
  const { data: integration, error: intErr } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("is_active", true)
    .single();

  if (intErr || !integration) throw new Error("Integration not found");

  const meta = (integration.metadata as Record<string, unknown>) ?? {};

  // 2. Determine last_checked_at (default: 24 hours ago)
  const lastCheckedAt: Date = meta.last_checked_at
    ? new Date(meta.last_checked_at as string)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const lastSeenIds: string[] = Array.isArray(meta.last_seen_message_ids)
    ? (meta.last_seen_message_ids as string[])
    : [];

  // Format date for Gmail query: YYYY/MM/DD
  const afterDate = `${lastCheckedAt.getFullYear()}/${String(lastCheckedAt.getMonth() + 1).padStart(2, "0")}/${String(lastCheckedAt.getDate()).padStart(2, "0")}`;

  // 3. Get valid access token (handles refresh if needed)
  const accessToken = await getValidAccessToken(integrationId);
  const gmail = getGmailClient(accessToken);

  // 4. Get all CRM customers for this user
  const { data: customers, error: custErr } = await supabase
    .from("crm_customers")
    .select("id, name")
    .eq("user_id", integration.user_id);

  if (custErr) throw custErr;
  if (!customers || customers.length === 0) return [];

  // Get contacts for all customers
  const customerIds = customers.map((c: { id: string; name: string }) => c.id);
  const { data: contacts, error: contactErr } = await supabase
    .from("contacts")
    .select("id, email, crm_customer_id")
    .in("crm_customer_id", customerIds)
    .not("email", "is", null);

  if (contactErr) throw contactErr;
  if (!contacts || contacts.length === 0) return [];

  // Group contacts by crm_customer_id
  const contactsByCustomer = new Map<
    string,
    { id: string; email: string; crm_customer_id: string }[]
  >();
  for (const contact of contacts) {
    if (!contact.email) continue;
    const list = contactsByCustomer.get(contact.crm_customer_id) ?? [];
    list.push(contact);
    contactsByCustomer.set(contact.crm_customer_id, list);
  }

  const results: NewEmailNotification[] = [];
  const newSeenIds: string[] = [];

  // 5. For each customer with contacts, query Gmail
  for (const customer of customers as { id: string; name: string }[]) {
    const customerContacts = contactsByCustomer.get(customer.id);
    if (!customerContacts || customerContacts.length === 0) continue;

    // Build query: "(from:a@x.com OR to:a@x.com) after:YYYY/MM/DD"
    const emailParts = customerContacts.map(
      (c) => `from:${c.email} OR to:${c.email}`,
    );
    const query = `(${emailParts.join(" OR ")}) after:${afterDate}`;

    try {
      const { messages } = await listMessages(gmail, query, 20);

      for (const msg of messages) {
        // Filter out already-seen messages
        if (lastSeenIds.includes(msg.id)) continue;

        newSeenIds.push(msg.id);
        results.push({
          subject: msg.subject || "(no subject)",
          from: msg.from,
          date: msg.date,
          messageId: msg.id,
          crmCustomerId: customer.id,
          crmCustomerName: customer.name,
        });
      }
    } catch {
      // Skip this customer if Gmail query fails
      continue;
    }
  }

  // 6. Update integration metadata
  // Ring buffer: keep most recent 100 seen IDs
  const updatedSeenIds = [...lastSeenIds, ...newSeenIds].slice(-100);

  await supabase
    .from("integrations")
    .update({
      metadata: {
        ...meta,
        last_checked_at: new Date().toISOString(),
        last_seen_message_ids: updatedSeenIds,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  return results;
}

export { GMAIL_SCOPES };
