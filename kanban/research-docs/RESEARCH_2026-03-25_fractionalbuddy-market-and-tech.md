# FractionalBuddy.com — Market & Technical Research

**Date:** 2026-03-25
**Purpose:** Comprehensive research into the fractional executive tools market, technical options for STT, calendar merging, meeting transcription, client portals, and FreeAgent integration — informing the implementation plan for fractionalbuddy.com.

---

## Table of Contents

1. [Market Landscape](#1-market-landscape)
2. [Speech-to-Text (STT) Pricing Comparison](#2-speech-to-text-stt-pricing-comparison)
3. [Calendar Merging Options](#3-calendar-merging-options)
4. [Meeting Transcription & Note-Taking](#4-meeting-transcription--note-taking)
5. [FreeAgent Integration](#5-freeagent-integration)
6. [Client Portal Patterns](#6-client-portal-patterns)
7. [Feature Gap Analysis](#7-feature-gap-analysis)
8. [Recommended Architecture](#8-recommended-architecture)
9. [Decisions Made](#9-decisions-made)
10. [AI Task Extraction from Meetings](#10-ai-task-extraction-from-meetings)
11. [Timer Widget UX Patterns](#11-timer-widget-ux-patterns)
12. [Supabase RLS for Multi-Tenant Portal](#12-supabase-rls-for-multi-tenant-portal)
13. [Ways of Working Questionnaire & Contract Ingestion](#13-ways-of-working-questionnaire--contract-ingestion)

---

## 1. Market Landscape

### Key Finding: No Purpose-Built "Fractional Executive OS" Exists

Fractional workers today cobble together 4-7 separate tools (Toggl + Notion + Google Calendar + FreshBooks + HubSpot CRM + Slack + Google Drive). The workflow is fragmented and no single product owns this persona.

### Existing Fractional Talent Platforms

| Service                     | Category             | What It Does                                       | Fractional-Specific? |
| --------------------------- | -------------------- | -------------------------------------------------- | -------------------- |
| Fraction (hirefraction.com) | Staffing marketplace | Sells fractional engineering talent to companies   | Engineers only       |
| FractionalJobs              | Job board            | Lists fractional executive roles                   | Yes                  |
| Bolster                     | Executive placement  | Places fractional C-suite at startups              | Yes                  |
| Catalant                    | Expert marketplace   | Enterprise-focused fractional/project-based talent | Partially            |
| A.Team                      | Team builder         | Curates teams of fractional product builders       | Partially            |

### Closest All-in-One Tools (Not Fractional-Specific)

| Tool            | Pricing          | Strengths                                                | Gaps for Fractional Work                             |
| --------------- | ---------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| **Bonsai**      | ~$21/mo          | Contracts, proposals, time tracking, invoicing, tax prep | No multi-client context switching, no calendar merge |
| **HoneyBook**   | ~$19/mo          | Client management, invoicing, contracts                  | No task-level visibility, no time tracking           |
| **Harvest**     | Free / $10.80/mo | Time tracking, invoicing, project budgets                | Team-oriented, no CRM or engagement scope            |
| **Toggl Track** | Free / $9-18/mo  | Easy client/project switching, reporting                 | No invoicing, no CRM, no calendar merge              |
| **Clockify**    | Free / $4-12/mo  | Unlimited free time tracking                             | Less polished UX, invoicing only on paid tiers       |

### What Fractional Workers Need That Regular Employees Don't

1. **Multi-client context switching** — 3-7 engagements with separate contexts, priorities, credentials
2. **Fractional-aware time allocation** — "hours per week allocated to Client A vs B" with guardrails
3. **Multi-calendar management** — unified view across 3-7 calendars from different domains
4. **Client-specific identity/branding** — different emails, Slack workspaces per client
5. **Engagement lifecycle management** — prospecting → contracting → active → winding down
6. **Scope creep protection** — tools to define boundaries and track out-of-scope requests
7. **Knowledge transfer & documentation** — playbooks, SOPs, decision logs (critical for handoff)
8. **Invoicing tied to deliverables** — retainer tracking, not just time x rate
9. **CRM for one** — lightweight pipeline/relationship manager for their own practice
10. **IP/work product separation** — reusable frameworks separate from client-specific work

---

## 2. Speech-to-Text (STT) Pricing Comparison

All prices normalized to per-minute and per-hour of audio.

### Comparison Table (Sorted by Cost)

| Provider                           | Price/min     | Price/hr    | Meeting Bot? | Diarization    | Real-time      | Free Tier           | English Quality |
| ---------------------------------- | ------------- | ----------- | ------------ | -------------- | -------------- | ------------------- | --------------- |
| **Self-hosted Whisper (large-v3)** | $0.0005-0.002 | $0.03-0.12  | No           | Via pyannote   | Batch only     | N/A (compute)       | Excellent       |
| **Groq Whisper API**               | $0.0011       | $0.066      | No           | No             | Near-real-time | Yes                 | Excellent       |
| **Alibaba Cloud ASR**              | $0.0007-0.002 | $0.04-0.12  | No           | Yes            | Yes            | Yes                 | Good            |
| **Tencent Cloud ASR**              | $0.001-0.002  | $0.06-0.12  | No           | Yes            | Yes            | Yes                 | Good            |
| **Baidu Cloud Speech**             | $0.001-0.003  | $0.06-0.18  | No           | Limited        | Yes            | Yes                 | Decent          |
| **Volcengine (ByteDance)**         | $0.001-0.003  | $0.06-0.18  | No           | Yes            | Yes            | Yes                 | Good            |
| **iFlytek**                        | $0.002-0.004  | $0.12-0.24  | No           | Yes            | Yes            | Yes                 | Good            |
| **Deepgram Nova-2**                | $0.0043       | $0.26       | No           | Yes (+$0.0005) | Yes            | $200 credit         | Excellent       |
| **Deepgram Nova-3**                | $0.0059       | $0.35       | No           | Yes (+$0.0005) | Yes            | $200 credit         | Excellent       |
| **Google Cloud STT v1**            | $0.006        | $0.36       | No           | Yes            | Yes            | 60 min/month        | Excellent       |
| **AWS Transcribe**                 | $0.006        | $0.36       | No           | Yes (included) | Yes            | 60 min/month (12mo) | Very Good       |
| **Azure Speech (batch)**           | $0.006        | $0.36       | No           | Yes (batch)    | Yes            | 5 hrs/month         | Excellent       |
| **AssemblyAI**                     | $0.006-0.0085 | $0.36-0.51  | No           | Yes (included) | Yes            | Free credits        | Excellent       |
| **Google Cloud Chirp 2**           | $0.016        | $0.96       | No           | Yes            | Yes            | 60 min/month        | Excellent       |
| **Recall.ai** (bot infra only)     | $0.02-0.04+   | $1.20-2.40+ | **Yes**      | N/A            | N/A            | No                  | N/A             |
| **MeetingBaas** (bot infra only)   | $0.02-0.05+   | $1.20-3.00+ | **Yes**      | N/A            | N/A            | Free trial          | N/A             |

### Detailed Provider Notes

#### Self-Hosted Whisper

| Hardware                       | Time to Process 1hr Audio | Cost/hr Audio | Monthly VPS Cost         |
| ------------------------------ | ------------------------- | ------------- | ------------------------ |
| CPU only (8-core Hetzner CX41) | 15-30 min                 | $0.03-0.06    | ~$15-20/mo               |
| NVIDIA T4 GPU (vast.ai spot)   | 3-6 min                   | $0.01-0.03    | ~$0.30-0.50/hr on-demand |
| NVIDIA A10/L4 GPU              | 1-3 min                   | $0.01-0.02    | ~$0.50-0.80/hr on-demand |

**Options:** faster-whisper (recommended, 4-8x faster), whisper.cpp (CPU-optimized), WhisperX (faster-whisper + pyannote diarization + word-level timestamps).

#### Groq Whisper API

- Models: whisper-large-v3, whisper-large-v3-turbo
- Processes 1 hour of audio in ~10-30 seconds
- No diarization — need post-processing with pyannote
- Best price-to-quality ratio for managed API

#### Deepgram Nova-2/Nova-3

- $200 free credit on signup (~700 hours free)
- Built-in diarization, punctuation, smart formatting
- Real-time streaming available
- Excellent API and documentation
- **Recommended for MVP**

#### Chinese Providers (Alibaba, Tencent, Baidu, ByteDance, iFlytek)

- Extremely cheap but English quality is a step below Western providers
- Data residency concerns (processed in China)
- API docs primarily in Chinese
- Payment typically requires Chinese payment methods
- Alibaba Cloud is most accessible internationally

### Total Cost Scenarios (1-Hour Meeting)

| Setup                               | Cost/hr    | Notes                            |
| ----------------------------------- | ---------- | -------------------------------- |
| Self-hosted Whisper + manual upload | $0.03-0.12 | Cheapest, no meeting bot         |
| Groq Whisper API + manual upload    | $0.07      | Very fast, no meeting bot        |
| Deepgram Nova-2 + manual upload     | $0.26      | Best quality + diarization       |
| Recall.ai + Groq                    | $1.20-2.50 | Full automation with meeting bot |
| Recall.ai + Deepgram                | $1.50-2.70 | Full automation, best quality    |
| Google Chirp 2                      | $0.96      | Expensive for what it is         |

### STT Decision

**MVP:** Deepgram Nova-2 ($0.28/hr with diarization, $200 free credit)
**Scale:** Self-hosted faster-whisper + pyannote on Hetzner
**Meeting bot:** Manual recording for now; Recall.ai/MeetingBaas later if needed

---

## 3. Calendar Merging Options

### Commercial Services

| Service            | Type                | How It Works                         | Real-time? | Privacy        | Cost            |
| ------------------ | ------------------- | ------------------------------------ | ---------- | -------------- | --------------- |
| **CalendarBridge** | Cloud sync          | Busy block sync between accounts     | Yes        | Medium (cloud) | ~$4/mo          |
| **Reclaim.ai**     | AI scheduler + sync | AI-powered scheduling, calendar sync | Yes        | Medium (cloud) | Free / $8-12/mo |
| **Morgen**         | Unified client app  | Renders all calendars locally        | Yes        | High (local)   | Free / $9/mo    |
| **OneCal**         | Cloud sync          | Event copy/busy blocks with rules    | Yes        | Medium (cloud) | ~$5/mo          |
| **Fantastical**    | Unified client app  | Mac/iOS multi-account calendar       | Yes        | High (local)   | Free / $5/mo    |

### Technical Approaches

#### Pattern A — Busy Block Sync (CalendarBridge, OneCal, Reclaim)

- Service reads Calendar A, writes "Busy" placeholder to Calendar B (and vice versa)
- Coworkers see you as "busy" without seeing details
- Requires OAuth access to all calendar accounts

#### Pattern B — Unified Client (Morgen, Fantastical)

- App renders both calendars side-by-side locally
- No data flows between providers — aggregation is purely local
- Others can't see cross-calendar conflicts

#### Pattern C — ICS Feed Overlay

- Export ICS URL from one calendar, import as read-only overlay in the other
- Google polls ICS feeds every 12-24 hours; Outlook ~3 hours
- Read-only, no editing
- Free, zero setup

#### Pattern D — DIY (Google Calendar API + Microsoft Graph API)

- Query free/busy from all sources, write blocker events to each target
- Run on schedule (every 5-15 minutes) or use webhooks for near-real-time
- ~200 lines of Python/Node.js
- Full control over privacy
- **This is the chosen approach**

### Calendar API Details

**Google Calendar API:**

- REST API with OAuth 2.0
- `freebusy.query` endpoint returns only busy intervals (privacy-preserving)
- Push notifications (webhooks) for changes
- Rate limits: ~1,000,000 queries/day per project

**Microsoft Graph API:**

- REST API covering all Microsoft 365 services
- `/me/calendar/events` and `/me/calendar/getSchedule` (free/busy for multiple users)
- Webhooks for change notifications
- Requires Azure AD app registration

### Privacy Considerations

- Free/busy sync only (no titles, no details) for cross-org sync
- Even "free/busy" reveals timing patterns
- Check with client IT before connecting corporate calendars
- Enterprise Microsoft 365 may block third-party OAuth apps

### Calendar Decision

**Approach:** DIY using Google Calendar API + Microsoft Graph API, integrated directly into the FractionalBuddy dashboard.

---

## 4. Meeting Transcription & Note-Taking

### Major Commercial Players

| Service          | Price                                | Platforms                      | API                     | Auto Time-Logging Potential                      |
| ---------------- | ------------------------------------ | ------------------------------ | ----------------------- | ------------------------------------------------ |
| **Otter.ai**     | Free (300min/mo) / Pro $16.99/mo     | Zoom, Meet, Teams              | Yes (Business+)         | Meeting start/end timestamps in API              |
| **Fireflies.ai** | Free (limited) / Pro $18/mo          | Zoom, Meet, Teams, Webex, GoTo | Yes (robust + webhooks) | Webhooks fire on start/end — best for automation |
| **Fathom**       | Free (unlimited Zoom) / Teams $32/mo | Zoom, Meet, Teams              | Limited (Zapier)        | Zapier triggers on meeting recorded              |
| **tl;dv**        | Free (unlimited) / Pro $18/mo        | Zoom, Meet, Teams              | Yes (Pro+, webhooks)    | Meeting timestamps + webhooks                    |
| **Grain**        | Free (limited) / Starter $19/mo      | Zoom, Meet, Teams              | Limited                 | Zapier/Slack integrations                        |
| **Avoma**        | Starter $19/mo / Plus $49/mo         | All major platforms            | Yes (higher tiers)      | Webhooks available                               |
| **Sembly AI**    | Free (limited) / Pro $10/mo          | Zoom, Meet, Teams, Webex       | Yes                     | Meeting metadata available                       |

### How Meeting Bots Join Calls

1. **Zoom:** Bots use Zoom Web SDK or raw UDP media streams. Join as "participant" via meeting link.
2. **Google Meet:** Puppeteer/Playwright opens headless Chrome, navigates to Meet URL, joins as guest. More fragile.
3. **Microsoft Teams:** Microsoft Graph Communications API. Join as "application" participant. Complex setup but stable.
4. **Common pattern:** Calendar integration detects upcoming meetings with video links, dispatches bot at scheduled time.

### Open-Source / Self-Hosted Options

| Tool                                | What It Does                                     | Notes                                   |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------- |
| **OpenAI Whisper / faster-whisper** | Speech-to-text engine                            | Transcription only, no meeting bot      |
| **WhisperX**                        | Whisper + pyannote diarization + word timestamps | Best open-source transcription pipeline |
| **Recall.ai**                       | Bot infrastructure (joins calls, captures audio) | API product, ~$0.02-0.04/min            |
| **MeetingBaas**                     | Same as Recall.ai, similar pricing               | REST API for bot lifecycle              |
| **Gladia**                          | Managed Whisper API + diarization                | Free 10hrs/mo, $0.61/hr after           |

### Meeting → Timesheet Auto-Logging Architecture

**Option A — No-code (fastest):**
Fireflies/tl;dv → Zapier webhook on meeting start/end → time-tracking API

**Option B — Custom (most control):**
Recall.ai bot → webhook on join/leave → middleware calls timesheet API + sends audio to Deepgram → stores transcript + time log together

**Option C — Lightweight (chosen for MVP):**
Calendar watcher (Google Calendar API) detects meetings → records start/end times → logs time automatically → record audio manually → batch transcribe with Deepgram

### Meeting Decision

**MVP:** Manual recording + Deepgram batch transcription. Calendar-based auto time logging (start/end from calendar events).
**Future:** Recall.ai/MeetingBaas bot for fully automated recording + transcription.

---

## 5. FreeAgent Integration

### API Overview

FreeAgent has a comprehensive public REST API (v2).

- **API Docs:** https://dev.freeagent.com/docs
- **Base URL:** `https://api.freeagent.com/v2/`
- **Sandbox URL:** `https://api.sandbox.freeagent.com/v2/`
- **Auth:** OAuth 2.0 (Authorization Code flow)
- **Tokens:** Access tokens expire after 12 hours; refresh tokens are long-lived
- **Rate Limit:** ~120 requests/minute per access token
- **Response Format:** JSON

### Key API Endpoints

| Resource      | Endpoint        | Read | Write | Purpose                           |
| ------------- | --------------- | ---- | ----- | --------------------------------- |
| **Timeslips** | `/v2/timeslips` | Yes  | Yes   | Create/update/delete time entries |
| **Invoices**  | `/v2/invoices`  | Yes  | Yes   | Create, send, mark as paid        |
| **Contacts**  | `/v2/contacts`  | Yes  | Yes   | Client/company records            |
| **Projects**  | `/v2/projects`  | Yes  | Yes   | Projects linked to contacts       |
| **Tasks**     | `/v2/tasks`     | Yes  | Yes   | Task types within projects        |
| **Users**     | `/v2/users`     | Yes  | Yes   | Team members                      |
| **Expenses**  | `/v2/expenses`  | Yes  | Yes   | Expense claims                    |

### FreeAgent Data Model

```
Contact (Client)
  └── Project (with budget, billing rate)
        └── Task (e.g., "Development", "Consulting")
              └── Timeslip (date, hours, user, comment, billable flag)
```

### Timesheet → Invoice Flow

1. Push timeslips to FreeAgent via API as hours are logged
2. Query uninvoiced timeslips: `GET /v2/timeslips?project={url}&status=non_invoiced`
3. Create invoice with line items derived from timeslips
4. Mark timeslips as invoiced by linking to the invoice
5. Pull invoice status back: `status` (Draft, Sent, Viewed, Overdue, Paid)

### UK-Specific Features

- **MTD for VAT** — submit VAT returns directly to HMRC from FreeAgent
- **MTD for ITSA** — preparing for upcoming requirements
- **VAT schemes:** Standard, Flat Rate, Cash Accounting
- **Corporation Tax estimates** — running CT liability calculation
- **Multi-currency** — invoice in foreign currencies

### Existing FreeAgent Integrations

- **Zapier:** Triggers (new invoice, timeslip, status change) + Actions (create contact, invoice, timeslip)
- **Make:** Full module support
- **Native:** Bank feeds (UK banks), PayPal, Stripe, GoCardless, Dext, Slack

### Integration Decision

**Approach:** Direct API integration (Option A) for core timeslip/invoice flows. FreeAgent sandbox for development.

---

## 6. Client Portal Patterns

### What Successful Client Portals Show vs Hide

**Visible to Client:**

| Category      | What to Show                            | Presentation                                    |
| ------------- | --------------------------------------- | ----------------------------------------------- |
| Progress      | High-level status per workstream        | Status cards or simple kanban (3-4 columns max) |
| Time Summary  | Hours per category per week/month       | Summary table or bar chart                      |
| Milestones    | Upcoming deliverables with target dates | Timeline or list with status badges             |
| Meeting Notes | Curated summaries with action items     | Chronological feed, most recent first           |
| Availability  | Next available slots / booking link     | Embedded scheduling widget                      |
| Deliverables  | Final/approved files                    | File list with download links                   |
| Activity Feed | Recent updates                          | Reverse-chronological, 1-2 sentences each       |

**Hidden from Client:**

| Item                      | Why                                          |
| ------------------------- | -------------------------------------------- |
| Internal notes            | Process thinking, draft ideas                |
| Other client data         | Strict tenant isolation                      |
| Hourly rates / rate math  | Client sees totals, not rate x hours         |
| Personal calendar details | They see availability, not what you're doing |
| Task-level minutiae       | "Research competitor pricing" is internal    |
| Draft deliverables        | Only share when ready                        |
| Tool artifacts            | Git commits, CI/CD, internal tickets         |

### Authentication Patterns

| Method                        | Friction | Security                     | Best For                      |
| ----------------------------- | -------- | ---------------------------- | ----------------------------- |
| **Magic links** (recommended) | Low      | Good                         | Infrequent visitors, clean UX |
| Shared URL with token         | Lowest   | Lower (URL can be forwarded) | Quick sharing                 |
| Full login (email + password) | Highest  | Best                         | Heavy client interaction      |

**Magic link flow:**

1. Consultant adds client email in admin
2. System generates unique portal URL and emails it
3. Client clicks link, gets a 30-day session
4. Link can be regenerated/revoked at any time

### Technical Architecture Patterns

| Pattern                        | How It Works                                             | Pros                              | Cons                                     |
| ------------------------------ | -------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| **Same app, role-based views** | Single codebase with `role` field (consultant vs client) | Single source of truth, real-time | Must prevent data leakage in every query |
| **Separate read-only site**    | Consultant app syncs to static client site               | Strong isolation                  | Data staleness, sync complexity          |
| **Filtered API + dashboard**   | Lightweight frontend calling scoped API                  | Clean separation                  | Need to build API layer                  |

**Recommended:** Single Next.js app with `/portal/[token]` routes. Middleware validates client token and scopes all queries. Everything defaults to NOT visible — consultant explicitly publishes items.

### Data Model Additions

```
ClientPortal: id, clientId, token (unique), isActive, lastViewedAt
PortalVisibility: isClientVisible boolean on tasks, notes, milestones
```

### Portal Design Principles

1. **Opt-in visibility** — nothing shows unless explicitly marked
2. **One portal per client** — strict data isolation (`WHERE clientId = ?`)
3. **Read-only by default** — a window, not a workspace
4. **Mobile-first** — clients check on their phone, use cards not tables
5. **Minimal refresh** — SSR or ISR, no WebSocket needed

---

## 7. Feature Gap Analysis

### David's Original Folders vs. Research Findings

| David's Folder | Status | Notes                                                         |
| -------------- | ------ | ------------------------------------------------------------- |
| Calendar       | Good   | Merged view is a core need                                    |
| Contacts       | Good   | Nobody else does this well for fractional workers             |
| CRM            | Good   | Lightweight client pipeline — simpler than Bonsai/HoneyBook   |
| Meetings       | Good   | Deepgram for transcription + calendar-based auto time logging |
| Research       | Good   | Unique to workflow                                            |
| Timesheet      | Good   | Timer widget + meeting auto-logging is the killer feature     |
| Assets         | Good   | Templates, diagrams — reusable IP                             |
| Deliverables   | Good   | Client work products, publishable to portal                   |

### Identified Gaps (All Accepted)

1. **Dashboard / Home** — single-page overview: hours this week, upcoming meetings, active tasks
2. **Tasks / Kanban** — auto-created from meeting action items, dependency tracking with client team
3. **Scope / Engagement** — contract terms, hours/week, rate, boundaries, scope creep tracking
4. **Notes / Knowledge Base** — working notes, decision logs, context for picking up after days away
5. **Invoicing / Reporting** — FreeAgent integration for timeslips and invoice status
6. **Shared with Client** — magic-link portal with curated view

---

## 8. Recommended Architecture

### Tech Stack (Aligned with GWTH v2)

| Layer                    | Technology                                       | Rationale                                                       |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------- |
| **Framework**            | Next.js 16 (App Router)                          | Same as GWTH v2                                                 |
| **React**                | React 19                                         | Same as GWTH v2                                                 |
| **Auth (consultant)**    | Supabase Auth (Google, GitHub, LinkedIn OAuth)   | Same as GWTH v2, built-in RLS                                   |
| **Auth (client portal)** | Supabase Auth magic links                        | Same auth system, zero friction for clients                     |
| **Database**             | Supabase (PostgreSQL) with Row Level Security    | Same as GWTH v2, RLS enforces client data isolation at DB level |
| **UI**                   | Tailwind CSS v4 + shadcn/ui + Radix UI           | Same as GWTH v2                                                 |
| **Icons**                | Lucide React                                     | Same as GWTH v2                                                 |
| **Animations**           | Motion (Framer Motion)                           | Same as GWTH v2                                                 |
| **Testing**              | Vitest + Playwright                              | Same as GWTH v2                                                 |
| **Code Quality**         | ESLint 9, Husky, lint-staged, Commitlint, Knip   | Same as GWTH v2                                                 |
| **Runtime**              | Node 22 (Alpine)                                 | Same as GWTH v2                                                 |
| **Hosting**              | Hetzner via Coolify                              | Existing infrastructure                                         |
| **STT**                  | Deepgram API (MVP) → self-hosted Whisper (scale) | Best quality/price, $200 free credit                            |
| **Calendar**             | Google Calendar API + Microsoft Graph API (DIY)  | Full control, privacy                                           |
| **Invoicing**            | FreeAgent API (OAuth 2.0)                        | Already using FreeAgent at Stellus                              |
| **Domain**               | fractionalbuddy.com                              | To be registered/configured                                     |

> **Note:** Stack deliberately mirrors GWTH v2 for consistency, shared knowledge, and code reuse (component library, auth patterns, deployment pipeline).

### Complete Module Map

| Module                 | Key Features                                                                    | Integrations           |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| **Dashboard**          | Hours this week, upcoming meetings, active tasks, recent activity               | All modules            |
| **Calendar**           | Merged Google + MS calendar, free/busy sync                                     | Google, Microsoft APIs |
| **Contacts**           | Name, phone, Slack ID, preferred contact method, skills, current work           | —                      |
| **CRM**                | Customer cards (Conscia → Holt-Renfrew, LoveSac, etc.)                          | —                      |
| **Meetings**           | Transcriptions, auto-extracted action items → tasks, summaries                  | Deepgram, Calendar     |
| **Research**           | Architecture/service research notes, searchable                                 | —                      |
| **Timesheet**          | Timer widget, meeting auto-logging, category dropdown, FreeAgent sync           | FreeAgent API          |
| **Tasks**              | Kanban per client, auto from meeting actions, dependency tracking               | Meetings               |
| **Assets**             | Templates, diagrams, reusable IP                                                | —                      |
| **Deliverables**       | Work products, versioned, publishable to portal                                 | Portal                 |
| **Engagement**         | Scope, contract terms, rate, boundaries, scope creep tracker                    | —                      |
| **Notes**              | Working notes, decision log, context for resuming after days away               | —                      |
| **Invoicing**          | Push timeslips to FreeAgent, pull payment status                                | FreeAgent API          |
| **Shared with Client** | Magic-link portal: progress, hours, milestones, deliverables, meeting summaries | All (filtered)         |

---

## 9. Decisions Made

| Decision                              | Choice                                          | Rationale                                                        |
| ------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| STT Provider (MVP)                    | Deepgram Nova-2                                 | $0.28/hr with diarization, $200 free credit, excellent quality   |
| STT Provider (Scale)                  | Self-hosted faster-whisper + pyannote           | Hetzner can run this, ~$0.03-0.06/hr                             |
| Meeting Bot                           | Manual recording (MVP)                          | 1-2 days/week doesn't justify bot cost yet                       |
| Calendar Merge                        | DIY (Google + MS Graph APIs)                    | Full control, privacy, integrates into dashboard                 |
| Invoicing                             | FreeAgent API (direct integration)              | Already using FreeAgent at Stellus                               |
| Client Portal Auth                    | Magic links                                     | Zero friction, good security balance                             |
| Client Portal Architecture            | Same app, role-based views (`/portal/[token]`)  | Simple, single source of truth                                   |
| Hosting                               | Hetzner via Coolify                             | Existing infrastructure                                          |
| Framework                             | Next.js 16 + Supabase (PostgreSQL + Auth + RLS) | Identical to GWTH v2 stack                                       |
| Chinese STT Providers                 | Not chosen                                      | English quality lower, data residency concerns, Chinese docs     |
| Expensive services (Fireflies, Otter) | Not chosen                                      | Per-seat pricing too high for solo fractional worker             |
| Action Item Extraction                | Claude Sonnet 4 via API                         | ~$0.06/meeting, best quality for nuanced extraction              |
| Timer Widget                          | Fixed widget + pop-out `/timer` route           | Hybrid approach, BroadcastChannel sync                           |
| Portal Security                       | Supabase RLS with custom JWT claims hook        | Server-controlled `user_roles` table, not user-editable metadata |
| Ways of Working                       | Contract ingestion + smart questionnaire        | AI reads contract first, then asks only what's NOT covered       |

---

## 10. AI Task Extraction from Meetings

### Pipeline Overview

```
Audio → Deepgram (STT + diarization) → Claude Sonnet (action extraction) → Draft Tasks → Human Review
```

Total cost per 1-hour meeting: ~$0.38 (Deepgram $0.26 + Claude $0.06 x2 passes)

### Extraction Approach

Use Claude Sonnet 4 via Anthropic API with a structured prompt. The prompt classifies each action item by confidence:

| Confidence Level | Meaning                              | Example                                        | Auto-Action                                        |
| ---------------- | ------------------------------------ | ---------------------------------------------- | -------------------------------------------------- |
| **explicit**     | Someone clearly commits              | "I'll send the proposal by Friday"             | Create as active task, flag for quick confirmation |
| **inferred**     | Assignment implied but not confirmed | "David, can you look into that?" (no response) | Create as draft, require assignee confirmation     |
| **tentative**    | Suggestion, not a commitment         | "We should probably look into caching"         | Create as suggestion, require decision to track    |

### Structured Output Schema

```json
{
  "action_items": [
    {
      "id": "AI-001",
      "task": "Clear, actionable description",
      "assignee": "Person name or 'Unassigned'",
      "due_date": "ISO date, relative date, or 'Not specified'",
      "priority": "high|medium|low",
      "confidence": "explicit|inferred|tentative",
      "source_quote": "Exact transcript line(s)",
      "dependencies": ["AI-XXX"]
    }
  ],
  "participants": ["name1", "name2"],
  "meeting_date": "ISO date"
}
```

### Dependency Detection

Two-pass approach for complex meetings:

1. **Pass 1:** Extract all action items without dependencies (simpler task, higher accuracy)
2. **Pass 2:** Given the list, ask Claude to identify blocking relationships

Linguistic patterns detected: "once X is done", "after we finish", "depends on", "blocked by", "can't start until", "waiting on", "first X, then Y".

### Speaker Resolution

Deepgram outputs `Speaker 0`, `Speaker 1`, etc. Resolution strategy:

1. Feed known participant names from calendar invite
2. Use first few minutes of transcript + known names to ask Claude to map speakers
3. Fallback: keep as `Speaker N` for human review

### Cost Estimates

| Component                           | Cost per 1-hour meeting |
| ----------------------------------- | ----------------------- |
| Deepgram Nova-2 (STT + diarization) | $0.26                   |
| Claude Sonnet 4 (extraction pass)   | $0.06                   |
| Claude Sonnet 4 (dependency pass)   | $0.06                   |
| **Total**                           | **~$0.38**              |

At 20 meetings/month: **~$7.60/month**

### Token Counts

| Meeting Type        | Words/hour   | Tokens (approx) |
| ------------------- | ------------ | --------------- |
| Slow (technical)    | 6,000-7,200  | 8,000-10,000    |
| Normal conversation | 7,800-9,600  | 10,000-13,000   |
| Fast discussion     | 9,600-12,000 | 13,000-16,000   |

---

## 11. Timer Widget UX Patterns

### Design: Hybrid Fixed Widget + Pop-Out

1. **Fixed widget** in corner of main app (`position: fixed`, 280x64px collapsed)
2. **Pop-out button** opens `/timer` in a small browser window (320x140px)
3. **BroadcastChannel API** syncs state between windows instantly

### Compact View — Show Exactly Three Things

| Element                 | Always Visible       | One Click Away |
| ----------------------- | -------------------- | -------------- |
| Running time (hh:mm:ss) | Yes                  | —              |
| Start/Stop button       | Yes                  | —              |
| Category pill           | Yes                  | —              |
| Today's total           | Small secondary text | —              |
| Description/notes       | —                    | Yes            |
| Tags                    | —                    | Yes            |

### Category Autocomplete — Learned, Not Configured

Categories derive entirely from past entries. No predefined list. Ranking uses a hybrid score:

- **Recency** (40%) — exponential decay over ~1 week
- **Frequency** (30%) — log scale, capped
- **Time-of-day affinity** (30%) — Gaussian, peaks at typical hour for that category

Example: "Admin" in the morning, "Development" in the afternoon — suggestions flip automatically.

Fuzzy matching via `fuse.js` as the user types. If no match, typed text becomes a new category.

### Key UX Decisions

- **One-click start** with most likely category pre-selected
- **Description is always optional** — "enrich later" pattern
- **Idle detection** after 15 minutes (mouse/keyboard activity tracking) — prompt: discard/keep/split
- **Long-running warning** after 2+ hours
- **Server-side timer state** — just a `started_at` timestamp in DB. Client computes display from `now - startedAt`. Survives refreshes, crashes, device switches.

### Keyboard Shortcuts

| Shortcut | Action                                       |
| -------- | -------------------------------------------- |
| `Alt+T`  | Toggle timer (start/stop)                    |
| `C`      | Open category selector (when widget focused) |
| `Esc`    | Close dropdown                               |

### Technical Architecture

```
/app/timer/page.tsx          — Pop-out route (minimal layout, no nav)
/components/timer/
  TimerWidget.tsx             — Fixed-position widget for main app
  TimerDisplay.tsx            — Shared display (used by both)
  CategorySelector.tsx        — Autocomplete dropdown with fuse.js
  TimerProvider.tsx            — Context provider + BroadcastChannel sync
/api/timer/route.ts           — GET current, POST start, PATCH stop
/api/timer/categories/route.ts — GET ranked categories
```

State sync via `BroadcastChannel('timer-sync')` for instant cross-tab updates. Database is source of truth.

---

## 12. Supabase RLS for Multi-Tenant Portal

### Architecture Summary

- **Consultant (David):** Full CRUD on all data via Supabase Auth (Google/GitHub/LinkedIn OAuth)
- **Clients:** SELECT only, filtered by `client_id` AND `is_client_visible = true`, via magic link auth
- **Security:** Custom JWT claims hook reads from server-controlled `user_roles` table (NOT user-editable metadata)

### Custom JWT Claims Hook

```sql
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'client',  -- 'consultant' or 'client'
  client_id uuid REFERENCES public.clients(id),
  UNIQUE(user_id)
);

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims jsonb;
  user_role public.user_roles%ROWTYPE;
BEGIN
  claims := event->'claims';
  SELECT * INTO user_role FROM public.user_roles WHERE user_id = (event->>'user_id')::uuid;
  IF FOUND THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role.role));
    claims := jsonb_set(claims, '{client_id}', to_jsonb(user_role.client_id));
  ELSE
    claims := jsonb_set(claims, '{app_role}', '"anonymous"');
    claims := jsonb_set(claims, '{client_id}', 'null');
  END IF;
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
```

Enable via Supabase Dashboard > Authentication > Hooks > "Customize Access Token (JWT) Claims".

### RLS Policy Pattern (Applied to All Data Tables)

```sql
-- Helper functions
CREATE FUNCTION public.get_app_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce((current_setting('request.jwt.claims', true)::jsonb)->>'app_role', 'anonymous');
$$;

CREATE FUNCTION public.get_client_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT ((current_setting('request.jwt.claims', true)::jsonb)->>'client_id')::uuid;
$$;

CREATE FUNCTION public.is_consultant() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.get_app_role() = 'consultant';
$$;

-- Per table (tasks, meetings, timesheets, deliverables, notes):
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

-- Consultant: full access
CREATE POLICY "consultant_full_access" ON public.tasks
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- Client: read own visible data only
CREATE POLICY "client_select_own_visible" ON public.tasks
  FOR SELECT USING (
    public.get_app_role() = 'client'
    AND client_id = public.get_client_id()
    AND is_client_visible = true
  );
```

### Security: Why This Is Safe

| Attack Vector              | Protection                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------- |
| JWT forgery                | JWTs signed with server-side secret, cannot be modified by client                      |
| Metadata manipulation      | Claims read from `user_roles` table (server-only), NOT `user_metadata` (user-writable) |
| Horizontal escalation      | RLS enforces `client_id = get_client_id()` on every query at DB level                  |
| Service role leak          | Only `NEXT_PUBLIC_SUPABASE_ANON_KEY` goes to browser, never service role key           |
| Stale JWT after revocation | Keep JWT expiry short (1hr), use refresh token rotation                                |

### Indexes for Performance

```sql
-- Partial indexes for client portal queries (WHERE is_client_visible = true)
CREATE INDEX idx_tasks_client_visible ON public.tasks(client_id, is_client_visible)
  WHERE is_client_visible = true;
-- Repeat for meetings, timesheets, deliverables, notes
```

RLS overhead: 1-5% for simple equality policies with proper indexes. Negligible for this data volume.

### Next.js Integration Pattern

- **Server client** (`@supabase/ssr` + anon key): All page data fetching. RLS applies automatically.
- **Admin client** (service role key): Background jobs, sending magic links, user management. Never exposed to browser.
- **Middleware:** Refreshes session tokens, redirects unauthenticated users from `/portal/*` routes.
- **Auth callback** (`/auth/callback`): Exchanges code for session, redirects consultant to `/dashboard`, client to `/portal`.

### Magic Link Flow

1. Consultant adds client email in admin UI
2. Backend calls `supabase.auth.admin.createUser()` + inserts `user_roles` row
3. System sends magic link via `supabase.auth.signInWithOtp({ email })`
4. Client clicks link → session created → JWT includes `app_role: 'client'` and `client_id`
5. All queries automatically filtered by RLS
6. Consultant can revoke via `supabase.auth.admin.signOut(userId, 'global')`

---

## 13. Ways of Working Questionnaire & Contract Ingestion

### The Problem

When starting a fractional engagement, there are two layers of information:

1. **Formal contract** — scope, rate, hours/week, start/end dates, IP ownership, NDA terms
2. **Ways of working** — the informal "how do we actually collaborate" knowledge that normally takes weeks to absorb through osmosis

Full-time employees learn layer 2 organically. Fractional workers, present only 1-2 days/week, can't afford that ramp time. A structured questionnaire accelerates this dramatically.

### Two-Step Flow: Contract First, Then Smart Questions

#### Step 1: Contract Ingestion

Upload the contract (PDF/DOCX) → AI extracts structured data:

```json
{
  "client_name": "Conscia",
  "role_title": "Fractional Solutions Architect",
  "start_date": "2026-04-01",
  "end_date": null,
  "hours_per_week": 16,
  "day_rate": "£XXX",
  "billing_frequency": "monthly",
  "notice_period": "30 days",
  "scope": [
    "Solution architecture for enterprise clients",
    "Pre-sales technical support",
    "Architecture documentation"
  ],
  "out_of_scope": ["Line management", "On-call/support"],
  "ip_ownership": "Client owns deliverables, consultant retains general know-how",
  "tools_provided": ["Slack", "Jira", "Confluence"],
  "nda": true,
  "key_contacts_mentioned": ["CTO", "VP Engineering"]
}
```

This auto-populates the Engagement section. Cost: ~$0.03-0.10 per contract (Claude Sonnet, contracts are typically 3-10 pages / 2,000-8,000 tokens).

#### Step 2: Smart Questionnaire

The questionnaire is generated dynamically — it only asks questions whose answers are NOT already in the contract. If the contract says "tools: Slack, Jira, Confluence", the questionnaire skips the "what tools do you use?" question.

### Questionnaire Categories

#### Communication & Availability

| Question                                                                | Why It Matters                                 | Populates                   |
| ----------------------------------------------------------------------- | ---------------------------------------------- | --------------------------- |
| What are your team's core working hours?                                | Know when people are available                 | Calendar, Engagement        |
| What's the preferred way to reach you for urgent vs non-urgent matters? | Avoid Slack for urgent, email for urgent, etc. | Contacts (preference field) |
| How quickly do you expect responses to messages?                        | Set SLA expectations                           | Engagement                  |
| Are there any regular no-meeting days or focus blocks?                  | Respect team rhythms                           | Calendar                    |
| What timezone(s) does the team operate in?                              | Schedule across zones                          | Calendar                    |

#### Meetings & Cadence

| Question                                                              | Why It Matters                    | Populates           |
| --------------------------------------------------------------------- | --------------------------------- | ------------------- |
| Which recurring meetings should I attend? (name, frequency, day/time) | Calendar setup, auto time-logging | Calendar, Timesheet |
| Are meetings recorded? If so, where are recordings stored?            | Meeting transcription setup       | Meetings module     |
| What's the expectation for meeting notes/minutes?                     | Know if you need to produce them  | Meetings module     |
| Who runs the meetings I'll attend?                                    | Key contacts                      | Contacts            |
| Is there a stand-up or check-in I should join?                        | Daily/weekly rhythm               | Calendar            |

#### Tools & Templates

| Question                                                                              | Why It Matters           | Populates    |
| ------------------------------------------------------------------------------------- | ------------------------ | ------------ |
| What document templates should I use? (docs, slides, spreadsheets, diagrams)          | Consistent deliverables  | Assets       |
| Where should I store/share deliverables? (SharePoint, Google Drive, Confluence, etc.) | File delivery workflow   | Deliverables |
| Do you have a diagram tool preference? (Miro, Lucidchart, draw.io, etc.)              | Match client tooling     | Assets       |
| Is there a code repository / architecture repo I should know about?                   | Technical context        | Research     |
| Are there style guides, brand guidelines, or naming conventions?                      | Professional consistency | Assets       |

#### Decision Making & Approvals

| Question                                                       | Why It Matters               | Populates              |
| -------------------------------------------------------------- | ---------------------------- | ---------------------- |
| Who approves architectural decisions?                          | Know the decision chain      | Contacts, CRM          |
| Is there an ADR (Architecture Decision Record) process?        | Documentation expectations   | Research, Deliverables |
| How are priorities set? Who decides what I work on day-to-day? | Task management              | Tasks, Engagement      |
| What's the change/release process?                             | Understand delivery pipeline | Research               |

#### Team & Culture

| Question                                                                                     | Why It Matters             | Populates          |
| -------------------------------------------------------------------------------------------- | -------------------------- | ------------------ |
| Who are the key people I'll work with most? (name, role, best way to reach them)             | Build contacts list        | Contacts           |
| Is there an org chart or team structure doc?                                                 | Understand reporting lines | Research, Contacts |
| Are there any team norms I should know about? (camera on/off in meetings, async-first, etc.) | Cultural fit               | Engagement         |
| How does the team handle disagreements or blocking issues?                                   | Escalation path            | Engagement         |

#### Onboarding & Access

| Question                                                         | Why It Matters                | Populates                                |
| ---------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| What systems/tools do I need access to? (with links if possible) | Onboarding checklist          | Tasks (auto-create access request tasks) |
| Is there onboarding documentation or a wiki I should read?       | Ramp-up                       | Research                                 |
| Who handles IT/access provisioning?                              | Know who to chase             | Contacts                                 |
| Are there any compliance/security training requirements?         | Don't miss mandatory training | Tasks                                    |

### Implementation Approach

#### Questionnaire as a Shared Form

The questionnaire lives at a shareable URL (e.g., `/onboarding/[engagement-id]`) that the client contact fills out. It's part of the client portal — sent alongside the first magic link.

```
/app/onboarding/[engagementId]/
  page.tsx           — Multi-step form wizard
  contract-upload.tsx — Step 1: Upload contract (consultant does this)
  questionnaire.tsx   — Step 2: Client fills out (magic link access)
  review.tsx          — Step 3: Consultant reviews answers
```

#### Smart Question Generation

After contract ingestion, generate the questionnaire dynamically:

```typescript
async function generateQuestionnaire(contractData: ContractExtraction) {
  // Start with the full question bank
  let questions = FULL_QUESTION_BANK;

  // Remove questions already answered by the contract
  if (contractData.tools_provided?.length > 0) {
    questions = questions.filter((q) => q.id !== "tools_used");
  }
  if (contractData.hours_per_week) {
    questions = questions.filter((q) => q.id !== "expected_hours");
  }
  if (contractData.scope?.length > 0) {
    questions = questions.filter((q) => q.id !== "primary_responsibilities");
  }

  // Optionally: use Claude to suggest additional questions based on contract context
  // e.g., if contract mentions "pre-sales", add "What's the typical sales cycle?"

  return questions;
}
```

#### Auto-Population from Answers

When the client submits the questionnaire, answers auto-populate multiple modules:

| Answer                     | Populates                                  |
| -------------------------- | ------------------------------------------ |
| Recurring meetings         | Calendar events + Timesheet categories     |
| Key contacts + preferences | Contacts module                            |
| Templates/style guides     | Assets (with download links or references) |
| Tool access needed         | Tasks (auto-created onboarding checklist)  |
| Working hours/timezone     | Calendar, Engagement                       |
| Decision approvers         | Contacts (role: approver), CRM             |

### Data Model

```sql
CREATE TABLE public.engagement_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid REFERENCES public.engagements(id) NOT NULL,
  client_id uuid REFERENCES public.clients(id) NOT NULL,
  status text DEFAULT 'draft', -- draft, sent, partial, completed, reviewed
  contract_data jsonb DEFAULT '{}',  -- extracted contract fields
  questions jsonb DEFAULT '[]',      -- generated question list
  answers jsonb DEFAULT '{}',        -- client's responses
  sent_to_email text,
  sent_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### How This Connects to the Engagement Module

The Engagement section has three data sources:

1. **Contract ingestion** → formal terms (scope, rate, hours, boundaries)
2. **Questionnaire answers** → practical working knowledge (meetings, tools, contacts, norms)
3. **Ongoing observations** → discovered over time (updated manually or from meeting notes)

Together these form a complete "engagement playbook" — the single place to look when you sit down on day 1 of your weekly engagement and need to remember how everything works.
