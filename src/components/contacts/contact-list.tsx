"use client";

import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ContactCard } from "./contact-card";
import { ContactForm } from "./contact-form";
import type { Contact } from "@/lib/types";

interface ContactListProps {
  contacts: Contact[];
  allSkills: string[];
}

export function ContactList({ contacts, allSkills }: ContactListProps) {
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(
    null,
  );

  const filtered = React.useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        c.skills.some((s) => s.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  function handleEdit(contact: Contact) {
    setEditingContact(contact);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingContact(null);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, or skills..."
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setEditingContact(null);
            setFormOpen(true);
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search ? "No contacts match your search." : "No contacts yet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        contact={editingContact}
        allSkills={allSkills}
      />
    </>
  );
}
