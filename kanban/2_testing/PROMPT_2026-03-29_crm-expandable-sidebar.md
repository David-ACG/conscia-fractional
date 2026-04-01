# PROMPT: Expandable CRM Sidebar + Dynamic Contacts Label

## Context

FractionalBuddy is a Next.js 16 app. The sidebar (`src/components/layout/sidebar.tsx`) has a flat nav list. CRM is one item that links to `/crm`. We need to make it expandable so it shows customer sub-items, and rename "Contacts" to show the active client name.

## Task

1. Create an API route to fetch CRM customers for the sidebar
2. Modify the sidebar to make CRM an expandable section with customer sub-list
3. Rename "Contacts" to dynamic "{ClientName} Contacts"

## Detailed Instructions

### 1. API Route (`src/app/api/crm-customers/route.ts`)

Create a GET endpoint that:

- Accepts `?clientId=xxx` query param
- Uses `createAdminClient` (from `@/lib/supabase/admin`) to bypass RLS
- Returns top 10 CRM customers ordered by: status='active' first, then name ascending
- Only returns `id, name, slug, status` fields (minimal for sidebar)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json([]);

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json([]);

  const { data } = await supabase
    .from("crm_customers")
    .select("id, name, slug, status")
    .eq("client_id", clientId)
    .order("status", { ascending: true }) // 'active' sorts first alphabetically
    .order("name")
    .limit(10);

  return NextResponse.json(data ?? []);
}
```

### 2. Sidebar Modification (`src/components/layout/sidebar.tsx`)

The sidebar currently has nav items as a flat array. Modify the CRM item to be expandable:

**Current structure:**

```typescript
const secondaryNavItems = [
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/crm", label: "CRM", icon: Building2 },
  ...
]
```

**New behaviour:**

- CRM item has a chevron toggle (ChevronRight/ChevronDown)
- When expanded, shows sub-items: one per customer (top 10) + "View all" link
- Each customer sub-item links to `/crm/[slug]` and shows a small avatar with the first letter
- The expand/collapse state persists in localStorage key `fb_crm_expanded`
- Use `useClient()` context to get `clientId` and fetch customers via `/api/crm-customers?clientId=xxx`
- Fetch customers in a useEffect when clientId changes
- When sidebar is collapsed (icon-only mode), CRM click goes to `/crm` as before

**Sub-item rendering:**

```
▸ CRM                    (collapsed)
▾ CRM                    (expanded)
    ● LoveSac
    ● Holt Renfrew
    ● Jaguar
    View all →
```

Use small circle indicators (not full avatars) for each customer. The active customer (matching current pathname `/crm/[slug]`) should be highlighted.

### 3. Dynamic Contacts Label

Change the "Contacts" nav item:

```typescript
// Before
{ href: "/contacts", label: "Contacts", icon: Contact },

// After — make it dynamic
```

The sidebar is a client component that has access to `useClient()`. Get the active client name and use it:

- If client is loaded: `"{ClientName} Contacts"` (e.g. "Conscia Contacts")
- If loading: just "Contacts"

Since the label can be long, truncate with CSS (`truncate` class) and show full text on hover via `title` attribute.

## Key Patterns

- The sidebar is a `"use client"` component
- It uses `usePathname()` for active state detection
- It uses `useSidebar()` hook for collapse state
- The `useClient()` hook provides `{ clientId, clients }` — `clients` is an array of `{ id, name, slug, industry }`
- Navigation items are rendered in a helper function/component
- Mobile uses a Sheet overlay, desktop uses a sticky aside

## Files to Create

- `src/app/api/crm-customers/route.ts`

## Files to Modify

- `src/components/layout/sidebar.tsx`

## Acceptance Criteria

1. CRM item in sidebar has expand/collapse toggle
2. When expanded, shows up to 10 customers with names
3. Each customer links to `/crm/[customer-slug]`
4. "View all" link at bottom goes to `/crm`
5. Active customer is highlighted based on current URL
6. Expand state persists across page navigations (localStorage)
7. "Contacts" label shows "{ClientName} Contacts" (e.g. "Conscia Contacts")
8. Works in both expanded and collapsed sidebar modes
9. All 135 existing tests pass
10. No TypeScript errors

## Test Expectations

- Run `npm test` — all existing tests must pass
- The sidebar tests (if any) may need mock updates for the new CRM expansion

---

## Review Checklist — 2026-03-29 11:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-29_crm-expandable-sidebar.md`
