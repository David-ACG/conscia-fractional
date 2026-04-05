# PROMPT: Portal Auth & Layout

**Goal:** Implement magic link authentication for the client portal, the portal layout with dynamic sidebar, and middleware updates.

## Context

FractionalBuddy's client portal allows consultants to share selected data modules with their clients. This prompt implements:

- Magic link login page for portal users
- Portal layout with sidebar showing only enabled modules
- Middleware updates to handle portal authentication

### Prerequisites (from previous prompts)

- `client_portal_settings` table exists with per-client module toggles
- `portal_invitations` table tracks invited users
- `user_roles` table has role='client' entries for portal users
- Server actions in `src/lib/actions/portal.ts` exist
- Types `PortalSettings`, `PortalInvitation`, `PortalModule` exist in `src/lib/types.ts`

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase Auth (magic links via `signInWithOtp`)
- Tailwind CSS v4 + shadcn/ui
- Route group: `(portal)`

## Implementation

### 1. Portal Login Page

**File:** `src/app/(portal)/portal/login/page.tsx`

Simple login page:

- Email input field
- "Send Magic Link" button
- Calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/portal' } })`
- Shows success message: "Check your email for a login link"
- Shows error if email not invited (check portal_invitations)
- No public signup — only pre-invited emails work
- Branded header: "FractionalBuddy Client Portal"

Layout should be clean and minimal — centered card on a neutral background.

### 2. Portal Auth Callback

**File:** `src/app/(portal)/portal/auth/callback/route.ts`

Handle the magic link callback:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Update portal_invitations: set auth_user_id, status='accepted', accepted_at
      // Update last_login
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/portal/login?error=auth_failed", request.url),
  );
}
```

### 3. Portal Layout

**File:** `src/app/(portal)/layout.tsx` (replace existing placeholder)

The portal layout should:

- Check authentication — redirect to `/portal/login` if not logged in
- Check user role — must be 'client' role
- Fetch enabled modules from `client_portal_settings`
- Render a sidebar with only enabled modules
- Show client name in header
- Include logout button

Structure:

```
+--------------------------------------------------+
| [Logo] Client Portal    [Client Name]  [Logout]  |
+--------------------------------------------------+
| Sidebar          | Main Content                   |
|                  |                                |
| Dashboard        | {children}                     |
| [enabled modules]|                               |
|                  |                                |
+--------------------------------------------------+
```

### 4. Portal Sidebar Component

**New file:** `src/components/portal/portal-sidebar.tsx`

Props: `enabledModules: string[]`

Navigation items (only show if enabled):

```typescript
const moduleNavItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, always: true },
  {
    href: "/portal/timesheet",
    label: "Timesheet",
    icon: Clock,
    module: "timesheet",
  },
  { href: "/portal/tasks", label: "Tasks", icon: CheckSquare, module: "tasks" },
  {
    href: "/portal/meetings",
    label: "Meetings",
    icon: Users,
    module: "meetings",
  },
  {
    href: "/portal/deliverables",
    label: "Deliverables",
    icon: FileOutput,
    module: "deliverables",
  },
  {
    href: "/portal/invoicing",
    label: "Invoicing",
    icon: Receipt,
    module: "invoicing",
  },
  { href: "/portal/notes", label: "Notes", icon: StickyNote, module: "notes" },
  {
    href: "/portal/research",
    label: "Research",
    icon: Search,
    module: "research",
  },
];
```

Filter: show items where `always: true` or `enabledModules.includes(item.module)`.

Style: Similar to main sidebar but simpler (no collapsible, no client switcher). Use the same color scheme and active state patterns.

### 5. Portal Header Component

**New file:** `src/components/portal/portal-header.tsx`

Shows:

- "FractionalBuddy" logo/text (left)
- Client name (center or right)
- Logout button (right) — calls `supabase.auth.signOut()` then redirects to `/portal/login`

### 6. Middleware Updates

**File:** `src/lib/supabase/middleware.ts`

Update the middleware to handle portal routes:

```typescript
// Portal paths need client auth
if (pathname.startsWith("/portal")) {
  // Allow login and callback pages without auth
  if (pathname === "/portal/login" || pathname.startsWith("/portal/auth")) {
    return next();
  }

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  // Check if user has client role (via user_roles table or JWT claims)
  // If not a client user, redirect to login with error
}
```

### 7. Portal Dashboard Page (placeholder)

**File:** `src/app/(portal)/portal/page.tsx` (replace existing)

For now, show a welcome message and summary cards placeholder:

```
Welcome to the Client Portal

[Summary cards will be populated in next prompt]

Recent Activity
[Activity feed will be populated in next prompt]
```

This page will be fully implemented in the next prompt (Portal Module Views).

## Tests

**File:** `src/__tests__/portal/portal-auth.test.ts`

Test:

1. Unauthenticated users are redirected to `/portal/login`
2. Login page renders email input and submit button
3. Portal layout shows only enabled modules in sidebar
4. Logout button calls signOut and redirects
5. Auth callback exchanges code for session

Run `npm test` to ensure no regressions.

## Acceptance Criteria

- [ ] Portal login page renders with email input and "Send Magic Link" button
- [ ] Magic link sends email via Supabase
- [ ] Auth callback exchanges code, sets session, redirects to /portal
- [ ] Portal layout shows sidebar with only enabled modules
- [ ] Portal header shows client name and logout button
- [ ] Unauthenticated users redirected to /portal/login
- [ ] Non-client users cannot access portal
- [ ] Portal dashboard page renders (placeholder content OK)
- [ ] All existing tests pass (`npm test`)

---

## Review Checklist — 2026-04-05 14:00

- [x] Instructions are clear and self-contained (no assumed context)
- [x] File paths are correct for this project
- [x] Acceptance criteria match the plan
- [x] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-05_03-portal-auth-layout.md`
