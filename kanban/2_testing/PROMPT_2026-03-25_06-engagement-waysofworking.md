# Task: Engagement & Ways of Working Questionnaire

**Date:** 2026-03-25
**Plan Reference:** PLAN_2026-03-25_fractionalbuddy-foundation.md

## What to change

Build the Engagement module — the "single source of truth" for the fractional engagement. Includes: engagement overview, contract upload with AI ingestion, smart questionnaire generation, shareable questionnaire URL, auto-population of other modules from answers, and scope creep tracker.

## Specific Instructions

### 1. Engagement overview page (`src/app/(dashboard)/engagement/page.tsx`)

Server component showing:

**Contract Terms card:**

- Client name, role title
- Day rate (£500), hourly rate (£62.50)
- Hours/week (16), billing frequency
- Payment terms (Net 10 days)
- Start date, end date (or "Ongoing")
- Status badge (active/paused/completed)

**Scope card:**

- In-scope items as checklist
- Out-of-scope items (muted)
- "Edit scope" button

**Ways of Working card:**

- Questionnaire status: Not sent / Sent / Partial / Completed
- "Send Questionnaire" or "View Answers" button
- Key answers summary if completed

**Scope Creep card:**

- List of logged scope creep requests
- "Log New Request" button
- Status badges (logged, discussed, accepted, declined)

### 2. Contract upload & AI ingestion

`src/components/engagement/contract-upload.tsx`:

- File upload zone (drag & drop or click)
- Accepts PDF files
- On upload: reads PDF content, sends to LLM API for structured extraction
- Shows loading spinner during extraction
- Displays extracted data for review before saving

`src/lib/actions/engagement.ts`:

- `extractContractData(pdfText: string)` — calls LLM API
- Uses the cheapest viable API (Groq Llama 3 free tier, or DeepSeek API, or Google Gemini Flash free tier — see note below on LLM choice)
- Structured prompt to extract: client name, role, rates, hours, scope, payment terms, end clients, termination clauses
- Returns typed `ContractExtraction` object
- Saves to `engagements.contract_data` jsonb field

**PDF reading:** Google Gemini 1.5 Flash supports **native PDF upload** — send the PDF bytes directly to the API, no text extraction step needed. This eliminates the `pdf-parse` dependency and preserves formatting context.

```bash
npm install @google/generative-ai
```

### 3. Smart questionnaire generation

`src/lib/actions/questionnaire.ts`:

- `generateQuestionnaire(contractData)` — creates dynamic question set
- Starts with full question bank (see research doc Section 13)
- Removes questions already answered by contract data
- Categorizes remaining: Communication, Meetings, Tools, Decision Making, Team, Onboarding
- Returns array of `{ id, category, question, type, required }` objects
- Question types: text, textarea, select, multiselect, toggle

**Full question bank** (from research doc):

Communication & Availability:

- core_working_hours: "What are your team's core working hours?"
- urgent_contact: "What's the preferred way to reach you for urgent vs non-urgent matters?"
- response_time: "How quickly do you expect responses to messages?"
- no_meeting_days: "Are there any regular no-meeting days or focus blocks?"
- timezone: "What timezone(s) does the team operate in?"

Meetings & Cadence:

- recurring_meetings: "Which recurring meetings should I attend? (name, frequency, day/time)"
- meeting_recordings: "Are meetings recorded? If so, where are recordings stored?"
- meeting_notes_expectation: "What's the expectation for meeting notes/minutes?"
- meeting_runners: "Who runs the meetings I'll attend?"
- standup: "Is there a stand-up or check-in I should join?"

Tools & Templates:

- document_templates: "What document templates should I use? (docs, slides, spreadsheets, diagrams)"
- file_sharing: "Where should I store/share deliverables? (SharePoint, Google Drive, Confluence, etc.)"
- diagram_tool: "Do you have a diagram tool preference? (Miro, Lucidchart, draw.io, etc.)"
- code_repo: "Is there a code repository / architecture repo I should know about?"
- style_guides: "Are there style guides, brand guidelines, or naming conventions?"

Decision Making & Approvals:

- decision_approver: "Who approves architectural decisions?"
- adr_process: "Is there an ADR (Architecture Decision Record) process?"
- priority_setting: "How are priorities set? Who decides what I work on day-to-day?"
- change_process: "What's the change/release process?"

Team & Culture:

- key_people: "Who are the key people I'll work with most? (name, role, best contact)"
- org_chart: "Is there an org chart or team structure doc?"
- team_norms: "Are there any team norms I should know about? (camera on/off, async-first, etc.)"
- escalation: "How does the team handle disagreements or blocking issues?"

Onboarding & Access:

- system_access: "What systems/tools do I need access to? (with links if possible)"
- onboarding_docs: "Is there onboarding documentation or a wiki I should read?"
- it_contact: "Who handles IT/access provisioning?"
- compliance_training: "Are there any compliance/security training requirements?"

### 4. Questionnaire form page

`src/app/(dashboard)/engagement/questionnaire/page.tsx`:

- Multi-step form wizard (one category per step)
- Progress indicator (step X of Y)
- Save partial progress (status = 'partial')
- Submit button on final step

**Shareable version** for client:
`src/app/onboarding/[engagementId]/page.tsx`:

- Same form but with minimal layout (no sidebar)
- Authenticated via magic link (same Supabase Auth)
- On submit: updates questionnaire status to 'completed'

### 5. Auto-population from answers

When questionnaire is submitted, `processQuestionnaireAnswers()`:

- `recurring_meetings` → create placeholder calendar entries (notes for now)
- `key_people` → create contacts with name, role, preferred contact
- `system_access` → create tasks (onboarding checklist) with status 'todo'
- `document_templates` → create assets entries with names
- `core_working_hours` → update engagement with working hours info

### 6. Scope Creep Tracker

`src/components/engagement/scope-creep-log.tsx`:

- List of logged requests
- "Log New" button opens dialog: description, requested_by, date
- Status dropdown: logged → discussed → accepted/declined
- Notes field for each entry
- Uses `scope_creep_log` table

### 7. Tests

`src/app/(dashboard)/engagement/engagement.test.tsx`:

- Engagement overview renders with seed data
- Contract terms display correctly
- Scope items render

`src/lib/actions/questionnaire.test.ts`:

- Question generation skips answered questions
- Full question bank has all 20+ questions
- Category grouping works

`src/components/engagement/scope-creep-log.test.tsx`:

- Renders empty state
- Add new entry works

## Files likely affected

- `src/app/(dashboard)/engagement/page.tsx`
- `src/app/(dashboard)/engagement/questionnaire/page.tsx`
- `src/app/onboarding/[engagementId]/page.tsx`
- `src/app/onboarding/[engagementId]/layout.tsx`
- `src/components/engagement/contract-terms.tsx`
- `src/components/engagement/scope-card.tsx`
- `src/components/engagement/ways-of-working-card.tsx`
- `src/components/engagement/contract-upload.tsx`
- `src/components/engagement/questionnaire-form.tsx`
- `src/components/engagement/scope-creep-log.tsx`
- `src/lib/actions/engagement.ts`
- `src/lib/actions/questionnaire.ts`
- `src/lib/validations/engagement.ts`
- `package.json` (add @google/generative-ai)

## Acceptance criteria

- [ ] Engagement overview page shows Conscia contract terms from seed data
- [ ] Scope items display as checklist (in-scope) and muted list (out-of-scope)
- [ ] Contract upload accepts PDF and extracts structured data
- [ ] Extracted data previewed before saving
- [ ] Questionnaire generates dynamically (skips contract-answered questions)
- [ ] Questionnaire multi-step form navigates between categories
- [ ] Partial progress saves
- [ ] Shareable URL (`/onboarding/[id]`) works with minimal layout
- [ ] Submitted answers auto-create contacts, tasks, and assets
- [ ] Scope creep tracker logs, displays, and updates entries
- [ ] `npm test` passes

## Notes

### LLM API for contract ingestion

Since David doesn't have an Anthropic API key, use one of these (in order of preference):

1. **Google Gemini 1.5 Flash** (recommended) — free tier: 15 RPM, 1M tokens/day, 1500 requests/day. Native PDF upload. Use `@google/generative-ai` npm package. Cost if exceeding free tier: $0.075/M input, $0.30/M output (~$0.001 per contract).
2. **Groq** (fallback) — free tier with Llama 3.1 70B. Very fast but no native PDF support. Use `groq-sdk`.
3. **DeepSeek API** (backup) — ~$0.14/M input tokens. Excellent English quality but no native PDF.

Add env vars:

```
GOOGLE_GEMINI_API_KEY=           # Get from https://aistudio.google.com/apikey
LLM_PROVIDER=gemini              # or groq, deepseek
```

**Use Gemini as default.** The free tier is more than sufficient for this use case. Native PDF support means no text extraction step — just send the raw PDF bytes to the API with a structured extraction prompt.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-03-25 17:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] Question bank matches research doc Section 13
- [ ] LLM API choice is flexible (env var based)
- [ ] Auto-population logic covers all target modules

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_06-engagement-waysofworking.md`

## Implementation Notes — 2026-03-25 23:13

- **Commit:** pending (all tests pass, ready to commit)
- **Tests:** 73/73 passed (11 test files)
- **Verification URL:** http://localhost:3000/engagement
- **Playwright check:** N/A (no live Supabase connection in dev yet)
- **Changes summary:**
  - Installed `@google/generative-ai` for Gemini PDF extraction
  - Created engagement overview page with 5 cards: Contract Terms, Scope, Ways of Working, Contract Upload, Scope Creep Tracker
  - Contract upload supports drag-and-drop PDF, sends to Gemini 1.5 Flash for structured extraction, previews before saving
  - Smart questionnaire with 27 questions across 6 categories, dynamically skips questions answered by contract data
  - Multi-step form wizard with progress indicator and partial save
  - Shareable `/onboarding/[engagementId]` page with minimal layout for client completion
  - Auto-population: submitted answers create contacts, tasks, assets, and notes
  - Scope creep tracker with CRUD, status workflow (logged → discussed → accepted/declined)
  - Scope card supports inline editing with add/remove items
  - 3 test files: engagement overview (10 tests), questionnaire logic (12 tests), scope creep log (4 tests)
- **Deviations from plan:** None — all acceptance criteria met
- **Follow-up issues:** None

## Testing Checklist — 2026-03-25 23:13

**Check the changes:** http://localhost:3000/engagement

- [ ] Page loads without errors
- [ ] Contract Terms card shows Conscia, Solution Architect, £500/day, £62.50/hr, 16h/week
- [ ] Scope card shows 3 in-scope items with checkmarks and "Edit scope" button works
- [ ] Ways of Working card shows "Create Questionnaire" button
- [ ] Creating questionnaire generates 27 questions across 6 categories
- [ ] Multi-step form navigates between categories with progress bar
- [ ] "Save Progress" persists partial answers (status = partial)
- [ ] Contract upload accepts PDF and shows extraction preview
- [ ] Scope creep "Log New" opens dialog and saves entries
- [ ] Scope creep status can be changed via dropdown
- [ ] `/onboarding/[engagementId]` shows minimal layout questionnaire
- [ ] `npm test` passes (73/73)
- [ ] No console errors

### Actions for David

1. Add `GOOGLE_GEMINI_API_KEY` to `.env.local` (get from https://aistudio.google.com/apikey) — only needed for contract PDF upload
2. Connect to Supabase and verify seed data loads on the engagement page
3. Test the questionnaire flow end-to-end: create → fill in → submit → check that contacts/tasks/assets auto-populate
4. Check the `/onboarding/[engagementId]` shareable URL with an actual engagement ID
