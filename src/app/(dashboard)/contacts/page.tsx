import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { ContactList } from "@/components/contacts/contact-list";
import type { Contact } from "@/lib/types";

async function getContactsData() {
  const clientId = await getActiveClientId();
  const supabase = createClient();

  if (!supabase || !clientId) {
    return { contacts: [], allSkills: [] };
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("client_id", clientId)
    .order("name", { ascending: true });

  const typedContacts = (contacts ?? []) as Contact[];

  const allSkills = new Set<string>();
  for (const c of typedContacts) {
    for (const skill of c.skills ?? []) {
      allSkills.add(skill);
    }
  }

  return {
    contacts: typedContacts,
    allSkills: Array.from(allSkills).sort(),
  };
}

export default async function ContactsPage() {
  const { contacts, allSkills } = await getContactsData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
      <p className="mt-1 text-muted-foreground">
        People at the client company.
      </p>

      <div className="mt-6">
        <ContactList contacts={contacts} allSkills={allSkills} />
      </div>
    </div>
  );
}
