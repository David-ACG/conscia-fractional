# Task: Project Scaffold — FractionalBuddy.com

**Date:** 2026-03-25
**Plan Reference:** PLAN_2026-03-25_fractionalbuddy-foundation.md

## What to change

Create a new Next.js 16 project for FractionalBuddy.com — a "Fractional Executive OS" web app. The scaffold must exactly mirror the GWTH v2 project patterns and design system (documented in `kanban/research-docs/RESEARCH_2026-03-25_gwth-v2-design-system.md`).

This prompt creates the project skeleton: dependencies, config files, auth flow, app shell (sidebar, header, theme), Docker build, and test config. No data or features yet — just the empty, working shell.

## Specific Instructions

### 1. Initialize the project

```bash
cd C:\Projects\conscia-fractional
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

If the directory already has files, work around them (the kanban/ folder and other existing folders should be preserved).

### 2. Install exact dependencies (match GWTH v2)

**Core:**

```
next@16 react@19 react-dom@19 react-hook-form zod date-fns
```

**UI:**

```
tailwindcss@4 @tailwindcss/postcss radix-ui class-variance-authority clsx tailwind-merge lucide-react motion next-themes sonner cmdk
```

**Auth/DB:**

```
@supabase/supabase-js @supabase/ssr
```

**Dev:**

```
vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
@playwright/test
husky lint-staged @commitlint/cli @commitlint/config-conventional
postcss knip
```

### 3. Configuration files

Copy these patterns exactly from GWTH v2 (see design system doc for exact content):

- `tsconfig.json` — strict mode, `noUncheckedIndexedAccess`, path aliases `@/* → ./src/*`
- `next.config.ts` — `output: "standalone"`, compress, images
- `postcss.config.mjs` — `@tailwindcss/postcss`
- `components.json` — shadcn new-york style, rsc, tsx, lucide icons
- `eslint.config.mjs` — nextVitals + nextTs
- `.commitlintrc.json` — conventional commits
- `vitest.config.ts` — jsdom, coverage thresholds (40%/35%)
- `playwright.config.ts` — desktop-chromium, desktop-dark, mobile-chromium projects
- `knip.json` — ignore UI components

### 4. Husky pre-commit hooks

```bash
npx husky init
```

- `.husky/pre-commit` — `npx lint-staged` then `npm test`
- `.husky/commit-msg` — `npx --no -- commitlint --edit $1`
- `.husky/post-merge` — `npm install`

### 5. Git init and .gitignore

Initialize git repo. Add standard Next.js .gitignore plus:

```
.env.local
.env*.local
supabase/.temp/
```

### 6. CSS & Design Tokens (`src/app/globals.css`)

Copy the GWTH v2 design token system exactly:

- OKLCH color space
- Light mode: aqua primary (#33BBFF), mint accent (#1CBA93)
- Dark mode: "Graphite Warm" (warm charcoal hue 60)
- All CSS variables mapped to Tailwind @theme
- Sidebar-specific tokens
- Custom utilities: `.text-gradient`, `.hover-lift`, `.animate-in`, `.skeleton`
- Focus ring styles, selection colors, base layer

**FractionalBuddy-specific changes:**

- Remove lesson prose styling (not needed)
- Remove grade/status colors (will add our own later)
- Keep chart colors (useful for timesheet/dashboard)

### 7. shadcn/ui components

Install via shadcn CLI:

```
button, card, badge, input, label, select, separator, skeleton, tabs, tooltip,
dialog, dropdown-menu, form, popover, command, sheet, avatar, checkbox, textarea,
progress, breadcrumb, navigation-menu
```

### 8. Root Layout (`src/app/layout.tsx`)

Mirror GWTH v2 exactly:

- Metadata: title "FractionalBuddy", description
- Fonts: Inter + JetBrains Mono (next/font/google)
- Body: `antialiased` class
- Providers: RootProvider, RouteProgress, Toaster (sonner)
- No analytics for now

### 9. Providers

`src/providers/root-provider.tsx`:

- ThemeProvider (next-themes, class attribute, defaultTheme "light", enableSystem)
- TooltipProvider (300ms delay)

`src/providers/theme-provider.tsx`:

- next-themes wrapper with `disableTransitionOnChange: true`

### 10. App Shell — Dashboard Layout

`src/app/(dashboard)/layout.tsx`:

- Flex layout with sidebar on left
- Main area: flex-col with sticky header + scrollable content
- Max width 1400px on content area

`src/components/layout/sidebar.tsx`:

- Collapsible: 280px expanded, 64px collapsed
- Mobile: Sheet overlay below 768px
- Logo: "FractionalBuddy" (text, no image for now)
- Navigation items (all link to placeholder pages for now):
  - **Main:** Dashboard, Calendar, Timesheet, Tasks, Meetings
  - **Secondary:** Contacts, CRM, Engagement, Research, Notes
  - **Tertiary:** Assets, Deliverables, Invoicing
  - **Bottom:** Shared with Client (portal link)
- Active state detection via pathname
- Icons from lucide-react for each item

`src/components/layout/header.tsx`:

- Sticky, z-40, 64px height
- Breadcrumb on left
- Right side: Theme toggle, user dropdown (avatar, sign out)
- Mobile: hamburger menu to open sidebar sheet

### 11. Shared Components

Copy from GWTH v2 patterns:

- `src/components/shared/route-progress.tsx` — top bar during navigation
- `src/components/shared/spinner.tsx` — dual-ring branded spinner
- `src/components/shared/theme-toggle.tsx` — sun/moon toggle
- `src/components/shared/empty-state.tsx` — icon + title + description + CTA

### 12. Utility files

`src/lib/utils.ts`:

- `cn()` — clsx + twMerge
- `formatDuration()`, `formatDate()`, `formatRelativeDate()`

`src/lib/config.ts`:

- Layout: SIDEBAR_WIDTH=280, COLLAPSED=64, HEADER=64, MAX_WIDTH=1400
- Animation: spring transition, fade duration, stagger delay
- Breakpoints: MOBILE=768, TABLET=1024
- App metadata: APP_NAME="FractionalBuddy", APP_URL="https://fractionalbuddy.com"

`src/lib/types.ts`:

- Placeholder types (will be filled in Prompt 2 with full schema types)

### 13. Supabase Client Setup

`src/lib/supabase/server.ts` — server-side client (anon key, cookies)
`src/lib/supabase/client.ts` — browser client (anon key)
`src/lib/supabase/admin.ts` — admin client (service role key)
`src/lib/supabase/middleware.ts` — session refresh helper

Follow GWTH v2 patterns exactly using `@supabase/ssr`.

### 14. Auth Flow

`src/app/auth/callback/route.ts` — exchange code for session, redirect based on role
`src/app/auth/login/page.tsx` — Google OAuth button (consultant) + magic link input (client)

### 15. Middleware

`src/middleware.ts`:

- Security headers (X-Frame-Options, HSTS, CSP, etc.) — copy from GWTH v2
- Auth session refresh via Supabase middleware
- Protect `/dashboard/*` routes (redirect to /auth/login if not authenticated)
- Allow `/portal/*` routes with client auth
- Allow `/auth/*` and `/api/*` routes
- Allow `/timer` route (pop-out timer, needs auth)

### 16. Placeholder Pages

Create minimal pages for all sidebar items so navigation works:

- `src/app/(dashboard)/dashboard/page.tsx` — "Dashboard coming soon"
- `src/app/(dashboard)/calendar/page.tsx`
- `src/app/(dashboard)/timesheet/page.tsx`
- `src/app/(dashboard)/tasks/page.tsx`
- `src/app/(dashboard)/meetings/page.tsx`
- `src/app/(dashboard)/contacts/page.tsx`
- `src/app/(dashboard)/crm/page.tsx`
- `src/app/(dashboard)/engagement/page.tsx`
- `src/app/(dashboard)/research/page.tsx`
- `src/app/(dashboard)/notes/page.tsx`
- `src/app/(dashboard)/assets/page.tsx`
- `src/app/(dashboard)/deliverables/page.tsx`
- `src/app/(dashboard)/invoicing/page.tsx`
- `src/app/(portal)/portal/page.tsx` — "Client Portal"
- `src/app/timer/page.tsx` — minimal layout, "Timer coming soon"

### 17. Dockerfile

Multi-stage build matching GWTH v2:

1. `base` — node:22-alpine
2. `deps` — npm ci
3. `builder` — npm run build
4. `runner` — standalone output, non-root user (nextjs:1001), PORT=3000

### 18. Environment variables

Create `.env.local.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 19. Tests

`src/test-setup.ts` — jsdom setup
`src/app/(dashboard)/dashboard/dashboard.test.tsx` — renders without error
`src/components/layout/sidebar.test.tsx` — renders nav items
`src/components/shared/theme-toggle.test.tsx` — toggles theme

## Files likely affected

All new files — this is a greenfield project. Key files listed in instructions above.

## Acceptance criteria

- [ ] `npm run dev` starts without errors on http://localhost:3000
- [ ] `npm run build` succeeds (standalone output)
- [ ] `npm test` passes (3 initial tests)
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes
- [ ] Google OAuth sign-in button renders on /auth/login
- [ ] After mock sign-in, sidebar renders with all 14 module links
- [ ] Clicking each sidebar link navigates to the correct placeholder page
- [ ] Theme toggle switches between light and dark mode
- [ ] Sidebar collapses/expands on desktop
- [ ] Sidebar becomes Sheet overlay on mobile viewport
- [ ] Breadcrumb shows current route
- [ ] Header shows user dropdown with sign out
- [ ] `/timer` route renders with minimal layout (no sidebar)
- [ ] Dockerfile builds successfully: `docker build -t fractionalbuddy .`
- [ ] Design system matches GWTH v2 (OKLCH colors, aqua/mint theme, same font stack)

## Notes

- Reference the GWTH v2 design system doc: `kanban/research-docs/RESEARCH_2026-03-25_gwth-v2-design-system.md`
- Reference GWTH v2 source files at `C:\Projects\GWTH_V2\src\` for exact patterns
- Do NOT copy GWTH-specific content (lessons, courses, progress) — only the shell
- Supabase project will be created manually — use env vars that default gracefully when not set
- The app should render and be navigable even without Supabase configured (graceful fallback)

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-03-25 17:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] GWTH v2 design system reference is included
- [ ] Dependency versions match GWTH v2

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_01-project-scaffold.md`

## Implementation Notes — 2026-03-25 22:15

- **Tests:** 3/3 passed (dashboard renders, sidebar nav items, theme toggle)
- **Lint:** 0 errors, 0 warnings
- **Typecheck:** Clean — no errors
- **Build:** Successful — standalone output at `.next/standalone/server.js`
- **Changes summary:**
  - Scaffolded Next.js 16 project with TypeScript, Tailwind v4, ESLint
  - Installed all dependencies matching GWTH v2 versions
  - Created OKLCH design token system (globals.css) — aqua primary, mint accent, Graphite Warm dark mode
  - Installed 20 shadcn/ui components (new-york style)
  - Created root layout with Inter + JetBrains Mono fonts, RootProvider, RouteProgress, Toaster
  - Created ThemeProvider (next-themes, class attribute) and TooltipProvider
  - Built collapsible sidebar with 14 module nav items + portal link + collapse toggle
  - Built sticky header with breadcrumb, theme toggle, user dropdown
  - Created shared components: spinner, route-progress, theme-toggle, empty-state
  - Set up Supabase clients (server, client, admin) with graceful fallback when env vars missing
  - Created middleware with security headers + auth route protection
  - Created auth flow: Google OAuth + magic link login, callback route
  - Created 13 dashboard placeholder pages, portal page, timer page
  - Created useSidebar hook with localStorage persistence + mobile detection
  - Created Dockerfile (multi-stage, node:22-alpine, standalone output)
  - Set up Husky hooks (pre-commit, commit-msg, post-merge)
  - Set up Vitest config with jsdom, coverage thresholds
  - Set up Playwright config with 3 projects (desktop, dark, mobile)
  - Created lib/config.ts, lib/utils.ts, lib/types.ts
- **Deviations from plan:** None
- **Follow-up issues:** None

---

## Testing Checklist — 2026-03-25 22:15

**Check the changes:** http://localhost:3000 (run `npm run dev`)

- [ ] Page loads without errors
- [ ] Sidebar shows all 14 module links + portal link
- [ ] Clicking each sidebar link navigates to correct placeholder page
- [ ] Theme toggle switches between light and dark mode
- [ ] Sidebar collapses/expands on desktop
- [ ] Sidebar becomes Sheet overlay on mobile viewport (resize to <768px)
- [ ] Breadcrumb shows current route name
- [ ] Header shows user dropdown with sign out option
- [ ] /auth/login shows Google OAuth button and magic link input
- [ ] /timer renders with minimal layout (no sidebar)
- [ ] /portal renders client portal placeholder
- [ ] Light/dark mode colors match GWTH v2 (aqua primary, mint accent, warm charcoal dark)

### Actions for David

- Run `npm run dev` and verify the app loads at http://localhost:3000
- Check sidebar navigation and theme toggle work correctly
- Create Supabase project and add env vars to `.env.local` when ready to test auth
- Docker build: `docker build -t fractionalbuddy .`

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-03-25_01-project-scaffold.md`
