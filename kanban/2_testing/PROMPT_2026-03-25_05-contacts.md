# Task: Contacts Module

**Date:** 2026-03-25
**Plan Reference:** PLAN_2026-03-25_fractionalbuddy-foundation.md

## What to change

Build the Contacts module — a directory of people at the client company (Conscia) with their contact preferences, skills, and what you're working on with each person. Supports add/edit/delete and a client-visible toggle for the portal.

## Specific Instructions

### 1. Contacts list page (`src/app/(dashboard)/contacts/page.tsx`)

Server component:

- Fetch contacts from Supabase, filtered by active client
- Search bar (filters by name, role, skills)
- Grid of contact cards (responsive: 3 cols desktop, 2 tablet, 1 mobile)
- "Add Contact" button (opens dialog)
- Sort: alphabetical by name (default)

### 2. Contact card (`src/components/contacts/contact-card.tsx`)

shadcn Card with:

- Avatar (initials-based, color from name hash — use shadcn Avatar)
- Name (bold), role (muted)
- Preferred contact method badge (Slack / Email / Phone / Teams) with icon
- Skills as badges (shadcn Badge, secondary variant)
- "Working on" text (truncated, full on hover/click)
- Quick actions: email link, phone link, Slack deeplink, LinkedIn link
- Client-visible toggle (small eye icon, muted when off)
- Edit button (pencil icon) → opens edit dialog
- Delete button (trash icon, with confirmation)

### 3. Add/Edit dialog (`src/components/contacts/contact-form.tsx`)

shadcn Dialog with react-hook-form + zod validation:

- Name (required)
- Role
- Email
- Phone
- Slack ID
- LinkedIn URL
- Preferred contact method (select: Slack, Email, Phone, Teams)
- Skills (tag input — type and press Enter to add, click X to remove)
- Working on (textarea)
- Notes (textarea)
- Client visible (checkbox)

Server action for save: `src/lib/actions/contacts.ts`

### 4. Tag input component (`src/components/ui/tag-input.tsx`)

Custom component for skills:

- Text input with existing tags shown as badges above
- Type text, press Enter → adds tag
- Click X on tag → removes it
- Autocomplete from existing skills across all contacts

### 5. Slack deeplink

Format Slack member links as: `slack://user?team=TEAM_ID&id=MEMBER_ID`
If only Slack ID is available: show as text with copy button

### 6. Tests

`src/components/contacts/contact-card.test.tsx`:

- Renders contact name, role, preferred method badge
- Skills badges render
- Edit button opens dialog

`src/app/(dashboard)/contacts/contacts.test.tsx`:

- Contact list renders
- Search filters contacts
- Add button is present

## Files likely affected

- `src/app/(dashboard)/contacts/page.tsx`
- `src/components/contacts/contact-card.tsx`
- `src/components/contacts/contact-form.tsx`
- `src/components/contacts/contact-list.tsx`
- `src/components/ui/tag-input.tsx`
- `src/lib/actions/contacts.ts`
- `src/lib/validations/contacts.ts` (zod schema)

## Acceptance criteria

- [ ] Contact list renders with seed data (Sana Remekie, Morgan Johanson)
- [ ] Search filters contacts by name, role, skills
- [ ] Contact card shows all fields (name, role, preferred method, skills, working on)
- [ ] Preferred contact method shown as badge with icon
- [ ] Add contact dialog opens, validates, saves to Supabase
- [ ] Edit contact dialog pre-fills existing data
- [ ] Delete contact with confirmation dialog
- [ ] Skills tag input works (add/remove tags)
- [ ] Client-visible toggle updates the database
- [ ] LinkedIn links open in new tab
- [ ] Responsive grid layout (3/2/1 columns)
- [ ] `npm test` passes

## Notes

- Seed data has 2 contacts: Sana Remekie (CEO & Co-founder) and Morgan Johanson
- Use Server Actions for mutations (not API routes) — matches GWTH v2 pattern
- Avatar colors derived from name hash (consistent color per person)

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-03-25 17:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] Contact fields match schema from Prompt 2
- [ ] Seed contacts match known data

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_05-contacts.md`

## Implementation Notes

<!-- Appended by Claude with timestamp (Gate 3) -->

## Testing Checklist

<!-- Appended by Claude with timestamp (Gate 4) -->

### Actions for David

<!-- ALWAYS include this section. State what David needs to do, or explicitly say "No actions required." -->
