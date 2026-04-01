# Plan: FractionalBuddy.com — Foundation & Core Modules

**Date:** 2026-03-25
**Status:** Awaiting Review
**Source Idea:** IDEA_2026-03-25_fractionalbuddy-v1.md

## Overview

Build the foundation of FractionalBuddy.com — a web-based "Fractional Executive OS" for managing David's part-time work at Conscia. This plan covers project scaffolding, authentication, database schema, and the first 4 core modules (Dashboard, Timesheet, Contacts, Engagement). These are the modules needed to start using the tool on day 1 of the Conscia engagement.

## Goals

- Working Next.js 16 app deployed to Hetzner via Coolify
- Supabase Auth with consultant login (OAuth) and client portal (magic links)
- Database schema with RLS for all tables
- Timer widget for immediate time tracking
- Contacts list populated with Conscia team
- Engagement section with contract ingestion and ways-of-working questionnaire

## Scope

### In Scope — Phase 1 (This Plan): Foundation + Day-1 Modules

**Prompt 1: Project Scaffold**

- Next.js 16 project with TypeScript, Tailwind v4, shadcn/ui
- Supabase client setup (server, browser, admin)
- Auth flow (consultant OAuth + magic link for clients)
- App shell: sidebar navigation, theme toggle, responsive layout
- Vitest + Playwright config
- Dockerfile for Coolify deployment
- Git repo init with Husky, lint-staged, Commitlint

**Prompt 2: Database Schema & RLS**

- Full Supabase schema for all 14 modules (design it all now, build incrementally)
- Custom JWT claims hook (user_roles table)
- RLS policies (consultant full access, client filtered read-only)
- Partial indexes for client portal queries
- Seed data for Conscia (client, contacts, engagement)

**Prompt 3: Dashboard**

- Landing page after login
- Cards: hours this week, upcoming meetings (placeholder), active tasks (placeholder), recent activity
- Responsive grid layout
- Data from Supabase (real for timesheet, placeholder for others until those modules exist)

**Prompt 4: Timesheet & Timer Widget**

- Timer widget (fixed position in app corner + pop-out `/timer` route)
- Start/stop with one click
- Category dropdown (learned from history, hybrid MRU+frequency+time-of-day ranking)
- Fuzzy search via fuse.js
- BroadcastChannel sync between main app and pop-out
- Timesheet view: daily/weekly list of entries
- Manual time entry (add past entries)
- Idle detection (15 min threshold)
- Server-side timer state (survives refresh/crash)

**Prompt 5: Contacts**

- Contact list with search/filter
- Contact card: name, role, email, phone, Slack ID, preferred contact method
- Skills tags
- "Working on" field (what you're doing with/for this person)
- Add/edit/delete contacts
- Client-visible flag per contact (for portal)

**Prompt 6: Engagement & Ways of Working**

- Engagement overview: scope, contract terms, hours/week, rate, boundaries
- Contract upload + AI ingestion (Claude Sonnet via API → structured data)
- Smart questionnaire generation (skip questions answered by contract)
- Shareable questionnaire URL for client to fill out
- Auto-population of other modules from answers
- Scope creep tracker (log out-of-scope requests)

### Out of Scope — Future Phases

**Phase 2: Calendar + Meetings + Tasks**

- Google Calendar API + MS Graph API integration
- Meeting transcription (Deepgram) + AI task extraction (Claude)
- Task kanban with dependency tracking
- Meeting auto-logging to timesheet

**Phase 3: CRM + Research + Notes + Assets + Deliverables**

- CRM customer cards
- Research notes (searchable)
- Working notes / decision log
- Asset management (templates, diagrams)
- Deliverables (versioned, publishable)

**Phase 4: Integrations + Client Portal**

- FreeAgent API integration (timeslips, invoice status)
- Client portal (magic link, `/portal/[token]` routes)
- "Shared with Client" curated view
- Invoicing dashboard

## Technical Approach

Stack AND design system mirror GWTH v2 exactly:

### Stack

- **Next.js 16** App Router with `src/app/` structure
- **Supabase** for auth + database + RLS (no ORM — direct Supabase client)
- **Tailwind CSS v4** with `@theme` in globals.css (no tailwind.config.js)
- **shadcn/ui** + Radix UI for components
- **Lucide React** for icons
- **Motion** (Framer Motion) for animations
- **Vitest** for unit/integration tests
- **Playwright** for E2E tests
- **Node 22 Alpine** Docker image for deployment

### Design System (copy from GWTH v2)

Full design system documented in: `kanban/research-docs/RESEARCH_2026-03-25_gwth-v2-design-system.md`

- **Color system:** OKLCH color space. Aqua primary (#33BBFF), mint accent (#1CBA93), "Graphite Warm" dark mode (warm charcoal hue 60)
- **Typography:** Inter (sans-serif) + JetBrains Mono (monospace) via next/font/google
- **Component styling:** shadcn/ui new-york style, rounded-xl cards, border + shadow-sm
- **Layout:** Collapsible sidebar (280px/64px), sticky 64px header, max-width 1400px content, responsive breakpoints at 768px (mobile) and 1024px (tablet)
- **Animations:** Motion (Framer Motion) — spring transitions, staggered card entrances, fade-in with slide-up
- **Theme:** Light/dark mode via next-themes (class attribute), CSS variables swap per theme, `disableTransitionOnChange: true`
- **Custom utilities:** `.text-gradient`, `.hover-lift`, `.animate-in`, `.skeleton` loading states
- **Focus/selection:** Primary color focus rings, custom selection colors
- **Chart colors:** 5-color palette for data visualisation (used in timesheet/dashboard)

Every prompt MUST reference this design system doc and match these patterns. The app should look and feel like it belongs to the same product family as GWTH.ai.

## Files Affected / Created

| File                         | Action | Notes                             |
| ---------------------------- | ------ | --------------------------------- |
| `package.json`               | Create | Dependencies, scripts             |
| `next.config.ts`             | Create | Standalone output, images         |
| `tsconfig.json`              | Create | Strict mode, path aliases         |
| `src/app/layout.tsx`         | Create | Root layout with providers        |
| `src/app/(dashboard)/`       | Create | All authenticated routes          |
| `src/app/(portal)/`          | Create | Client portal routes              |
| `src/app/auth/`              | Create | Auth routes + callback            |
| `src/lib/supabase/`          | Create | Server, client, admin, middleware |
| `src/components/ui/`         | Create | shadcn/ui components              |
| `src/components/timer/`      | Create | Timer widget + pop-out            |
| `src/components/contacts/`   | Create | Contact list + cards              |
| `src/components/engagement/` | Create | Engagement + questionnaire        |
| `src/components/dashboard/`  | Create | Dashboard cards                   |
| `src/middleware.ts`          | Create | Auth + route protection           |
| `Dockerfile`                 | Create | Multi-stage build                 |
| `vitest.config.ts`           | Create | Test configuration                |
| `playwright.config.ts`       | Create | E2E test configuration            |
| `supabase/migrations/`       | Create | Database schema + RLS             |

## Acceptance Criteria

### Prompt 1: Project Scaffold

- [ ] `npm run dev` starts without errors
- [ ] `npm run build` succeeds
- [ ] `npm test` runs (even if no tests yet)
- [ ] Consultant can sign in via Google OAuth
- [ ] Sidebar navigation renders with all module links
- [ ] Theme toggle (light/dark) works
- [ ] Responsive: sidebar collapses on mobile
- [ ] Dockerfile builds successfully

### Prompt 2: Database Schema & RLS

- [ ] All tables created with correct relationships
- [ ] Custom JWT claims hook deployed
- [ ] Consultant user can CRUD all tables
- [ ] Client user can only SELECT visible rows for their client_id
- [ ] Client user cannot see other clients' data
- [ ] Seed data for Conscia client exists

### Prompt 3: Dashboard

- [ ] Dashboard renders after login
- [ ] "Hours this week" card shows real data from timesheet
- [ ] Placeholder cards for meetings, tasks, activity render
- [ ] Responsive grid layout works on mobile

### Prompt 4: Timesheet & Timer Widget

- [ ] Timer starts/stops with one click
- [ ] Running time displays and updates every second
- [ ] Category dropdown shows previous entries ranked by hybrid score
- [ ] Fuzzy search filters categories
- [ ] Pop-out `/timer` opens in small window
- [ ] BroadcastChannel syncs timer state between windows
- [ ] Timer survives page refresh (server-side state)
- [ ] Idle detection prompts after 15 minutes
- [ ] Manual time entry works (add past entries)
- [ ] Timesheet daily/weekly view displays entries

### Prompt 5: Contacts

- [ ] Contact list renders with search
- [ ] Contact card shows all fields (name, role, email, phone, Slack, preference, skills)
- [ ] Add/edit/delete contacts works
- [ ] "Working on" field editable
- [ ] Client-visible toggle works

### Prompt 6: Engagement & Ways of Working

- [ ] Engagement overview page shows contract terms
- [ ] Contract upload (PDF) triggers AI extraction
- [ ] Extracted data populates engagement fields
- [ ] Questionnaire generates dynamically (skips contract-answered questions)
- [ ] Shareable URL works for client to fill out
- [ ] Submitted answers auto-populate contacts/calendar/tasks
- [ ] Scope creep tracker logs out-of-scope requests

## Dependencies

- Supabase project created (free tier)
- Google OAuth credentials configured in Supabase
- Anthropic API key for contract ingestion (Prompt 6)
- Domain fractionalbuddy.com registered and pointed to Hetzner

## Testing Plan

- Unit tests: `npm test` (Vitest) — component rendering, utility functions, API routes
- E2E tests: Playwright — auth flow, timer widget, contact CRUD, questionnaire flow
- Each prompt includes specific test files

## Estimated Complexity

**Large** — 6 prompts covering project setup, auth, database, and 4 functional modules. Each prompt is a self-contained unit of work. Estimated 2-3 days of build time via run-kanban.sh.

---

## Review Checklist — 2026-03-25 16:00

- [ ] Scope is correctly bounded (not too broad, not too narrow)
- [ ] Technical approach matches the project's stack and conventions
- [ ] Files affected list is complete and accurate
- [ ] Acceptance criteria are specific and testable
- [ ] No unexpected dependencies introduced
- [ ] Estimated complexity feels right
- [ ] Phase boundaries make sense (day-1 needs vs later modules)
- [ ] Prompt ordering is correct (scaffold → schema → dashboard → timesheet → contacts → engagement)

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-03-25_fractionalbuddy-foundation.md`
