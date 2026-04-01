# PROMPT 01: Client Switcher + Multi-Client Support

## Context

FractionalBuddy is a Next.js 16 app for fractional executives managing multiple clients. Currently, the app hardcodes a single active engagement to determine the client. David has 5+ clients (Conscia is the first). We need a client switching mechanism so all pages filter data by the selected client.

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), Supabase, @supabase/ssr

## What to Build

### 1. Client Context Provider (`src/lib/client-context.tsx`)

Create a React context that stores the selected client ID:

```typescript
"use client";
// ClientProvider wraps the dashboard layout
// - On mount, reads selectedClientId from localStorage
// - If none stored, fetches first active engagement's client_id from Supabase
// - Provides { clientId, setClientId, clients, isLoading }
// - When setClientId changes, writes to localStorage
// - clients: Client[] fetched on mount for the dropdown
```

Interface:

```typescript
interface ClientContextValue {
  clientId: string | null;
  setClientId: (id: string) => void;
  clients: Array<{
    id: string;
    name: string;
    slug: string;
    industry: string | null;
  }>;
  isLoading: boolean;
}
```

Fetch clients using the browser Supabase client (`createClient` from `@/lib/supabase/client`):

```typescript
const supabase = createClient();
const { data } = await supabase
  .from("clients")
  .select("id, name, slug, industry")
  .order("name");
```

### 2. Client Switcher Dropdown (`src/components/layout/client-switcher.tsx`)

A Slack-style dropdown at the top of the sidebar. Uses the `useClient()` hook.

```
"use client"
// Popover trigger showing:
//   - Current client name (bold) + industry (muted, small)
//   - ChevronDown icon
// Popover content:
//   - List of clients, each clickable
//   - Active client has a check icon
//   - Separator
//   - "+ Add Client" button at bottom (opens AddClientDialog)
// When client clicked: call setClientId, close popover
```

Use shadcn Popover + Command (for searchable list if many clients). Style:

- Trigger: `w-full justify-between` button, text-left
- Width matches sidebar (account for collapsed state — show only icon when collapsed)
- When sidebar collapsed: show first letter of client name as avatar

### 3. Add Client Dialog (`src/components/layout/add-client-dialog.tsx`)

Dialog form to create a new client AND its first engagement in one step.

```
"use client"
// Dialog with form fields:
//   Client: name (required), industry, website
//   Engagement: role_title (required), day_rate_gbp, hourly_rate_gbp, hours_per_week, billing_frequency (select: weekly/fortnightly/monthly)
// On submit: calls createClientWithEngagement server action
// On success: refreshes client list, switches to new client, closes dialog
```

Use react-hook-form + zod. Fields layout: 2-column grid where sensible.

### 4. Server Actions (`src/lib/actions/clients.ts`)

```typescript
"use server";

// createClientWithEngagement(data) → { success, clientId } | { error }
//   1. Insert into clients table (name, slug from name, industry, website)
//   2. Insert into engagements table (client_id, role_title, day_rate_gbp, hourly_rate_gbp, hours_per_week, billing_frequency, status: 'active')
//   3. revalidatePath("/dashboard")
//   4. Return { success: true, clientId }
//
// Slug generation: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// getClients() → Client[] (for server-side fetches on pages)
//   SELECT id, name, slug, industry FROM clients ORDER BY name

// getActiveEngagement(clientId: string) → Engagement | null
//   SELECT * FROM engagements WHERE client_id = clientId AND status = 'active' LIMIT 1
```

### 5. Update Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

Wrap the existing layout children with `<ClientProvider>`:

```typescript
import { ClientProvider } from "@/lib/client-context"

export default function DashboardLayout({ children }) {
  return (
    <ClientProvider>
      {/* existing sidebar + header + main layout */}
    </ClientProvider>
  )
}
```

### 6. Update Sidebar (`src/components/layout/sidebar.tsx`)

Add `<ClientSwitcher />` at the top of the sidebar, above the navigation links. Insert it after the sidebar header/logo area, before the first nav group.

### 7. Update Existing Pages to Use Client Context

Each page that fetches data needs to filter by the selected client. The pattern:

**Problem:** Pages are server components but clientId is in client-side context.

**Solution:** Use `searchParams` or a client-side wrapper. The cleanest approach for this app:

Create a thin client wrapper component for each page that reads the context and passes clientId to the server-fetched data via a **client-side data fetching pattern** using `useEffect` + Supabase browser client. BUT this breaks the server component pattern.

**Better approach:** Use cookies. When the client switcher changes clientId:

1. Write a cookie `fb_client_id` via a server action `setActiveClient(clientId)`
2. Server components read the cookie: `cookies().get('fb_client_id')?.value`
3. This preserves the server component pattern

Update `src/lib/actions/clients.ts` to add:

```typescript
"use server";
import { cookies } from "next/headers";

export async function setActiveClient(clientId: string) {
  const cookieStore = await cookies();
  cookieStore.set("fb_client_id", clientId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // needs to be readable by client context too
    sameSite: "lax",
  });
  revalidatePath("/"); // revalidate everything
}

export async function getActiveClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  const stored = cookieStore.get("fb_client_id")?.value;
  if (stored) return stored;

  // Fallback: get first active engagement's client_id
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("engagements")
    .select("client_id")
    .eq("status", "active")
    .limit(1)
    .single();
  return data?.client_id ?? null;
}
```

Then update the client context to call `setActiveClient()` when switching, and use the cookie value as initial state.

**Pages to update:**

Each page's data-fetch function changes from hardcoded active engagement to explicit clientId:

- `src/app/(dashboard)/dashboard/page.tsx` — call `getActiveClientId()`, filter all queries by client_id
- `src/app/(dashboard)/timesheet/page.tsx` — filter time_entries by engagement's client_id
- `src/app/(dashboard)/contacts/page.tsx` — filter contacts by client_id
- `src/app/(dashboard)/engagement/page.tsx` — filter engagement by client_id

For each, the pattern is:

```typescript
import { getActiveClientId } from "@/lib/actions/clients";

async function getPageData() {
  const clientId = await getActiveClientId();
  if (!clientId)
    return {
      /* empty defaults */
    };

  const supabase = await createClient();
  // ... queries with .eq("client_id", clientId)
}
```

### 8. Update Server Actions to Accept clientId

Update `src/lib/actions/contacts.ts`:

- `createContact`: Replace the engagement query with `getActiveClientId()` to get client_id
- Same for other actions that need client_id

Update `src/lib/actions/engagement.ts`:

- Functions that query engagements should filter by clientId from `getActiveClientId()`

## Acceptance Criteria

- [ ] Client switcher dropdown appears at top of sidebar
- [ ] Dropdown shows all clients with active client highlighted
- [ ] Clicking a different client switches all page data
- [ ] "+ Add Client" opens dialog, creates client + engagement, switches to it
- [ ] Selected client persists across page navigations (cookie-based)
- [ ] Selected client persists across browser refreshes
- [ ] When sidebar is collapsed, client switcher shows compact version (first letter)
- [ ] Dashboard hours/engagement/activity filter by selected client
- [ ] Timesheet entries filter by selected client's engagement
- [ ] Contacts filter by selected client
- [ ] Engagement page shows selected client's engagement
- [ ] Existing tests pass (`npm test`)
- [ ] New test: `clients.test.ts` testing createClientWithEngagement, getActiveClientId

## Test Expectations

File: `src/lib/actions/__tests__/clients.test.ts`

- Test slug generation from client name
- Test createClientWithEngagement returns success with clientId
- Test getActiveClientId returns null when no engagements exist
- Mock Supabase client for all tests (follow existing test patterns)

## Files to Create

- `src/lib/client-context.tsx`
- `src/components/layout/client-switcher.tsx`
- `src/components/layout/add-client-dialog.tsx`
- `src/lib/actions/clients.ts`
- `src/lib/actions/__tests__/clients.test.ts`

## Files to Modify

- `src/app/(dashboard)/layout.tsx` — wrap with ClientProvider
- `src/components/layout/sidebar.tsx` — add ClientSwitcher
- `src/app/(dashboard)/dashboard/page.tsx` — use getActiveClientId
- `src/app/(dashboard)/timesheet/page.tsx` — use getActiveClientId
- `src/app/(dashboard)/contacts/page.tsx` — use getActiveClientId
- `src/app/(dashboard)/engagement/page.tsx` — use getActiveClientId
- `src/lib/actions/contacts.ts` — use getActiveClientId instead of hardcoded engagement query
- `src/lib/actions/engagement.ts` — filter by clientId

---

## Review Checklist — 2026-03-26 19:40

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Cookie-based approach is sound for server component + client context hybrid

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-26_01-client-switcher.md`
