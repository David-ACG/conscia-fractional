# WorkPA Coach Context Brief

Date: 15 May 2026

Use this as quick context for future sessions.

## Product direction

WorkPA is evolving from "AI PA for email/calendar/tasks/meetings" into:

> A personal AI PA and work coach that helps users run their day, capture meeting actions, manage stakeholders, and build the evidence needed for promotion.

The product should stay low-risk: user-triggered, approval-based, source-linked, private by default, and never an always-on autonomous agent.

## Core user promise

- Start the day clear.
- Never miss important work.
- Leave meetings with tasks and decisions captured.
- Know which stakeholders need attention.
- Build a promotion case from real work evidence.
- Get coached on communication, visibility, and career growth.

## Coach modules to build

1. Career Profile
   - current role, target role, manager, promotion cycle, competencies, personal goals

2. Stakeholder Map
   - internal/external stakeholders, team structure, power, interest, support level, relationship strength, last contact, next action

3. Achievement Tracker
   - STAR-formatted wins from tasks, meetings, emails, user notes, metrics, and praise

4. Promotion Plan
   - target role criteria, evidence coverage, gaps, next best achievement, manager conversation prep

5. Manager 1:1 Prep
   - wins, blockers, decisions, feedback questions, promotion evidence, commitments

6. Weekly Work Coach Review
   - wins, misses, stakeholder changes, achievement evidence, risks, development action for next week

7. Communication Practice
   - rehearse promotion asks, feedback requests, stakeholder updates, conflict handling, and visibility conversations

## Achievement tracker principles

Capture wins automatically where possible, but ask the user to confirm.

Useful achievement categories:

- measurable business impact
- project leadership
- cross-functional influence
- process improvement
- customer/client impact
- risk reduction
- mentoring/supporting others
- strategic thinking
- communication/visibility
- learning applied to work

Every achievement should store:

- date
- source links
- Situation
- Task
- Action
- Result
- metrics/evidence
- stakeholders affected
- skills/competencies
- promotion relevance
- review state

## Stakeholder model

Use a pragmatic power/interest map.

Fields:

- person/team/company
- internal or external
- role
- connected projects
- power/influence
- interest
- support level
- relationship strength
- communication cadence
- last contact
- next useful touchpoint
- evidence that matters to them

Do not let AI silently label people negatively. Labels such as blocker/sceptic must be evidence-backed and user-reviewed.

## Backend recommendation

Do not use Karpathy's LLM Wiki as the entire backend.

Use:

- Postgres/Supabase as system of record.
- Encrypted raw source store for meeting audio/transcripts/email snippets/docs.
- pgvector/full-text search for recall.
- Per-user AI-maintained wiki as compiled knowledge/context.
- Optional graph layer later for stakeholder/project relationships.

Principle:

> Database owns truth. Wiki owns understanding. Search owns recall. LLM owns drafting. User owns approval.

## AI Wiki shape

Possible per-user wiki:

```text
wiki/
  index.md
  log.md
  user/profile.md
  user/working-style.md
  user/career-goals.md
  people/
  teams/
  projects/
  meetings/
  achievements/
  coaching/promotion-plan.md
  coaching/stakeholder-map.md
  coaching/weekly-reviews.md
```

Every wiki page should include source IDs, canonical entity IDs, last compiled time, confidence, and review state.

## Safety boundaries

WorkPA is not:

- a therapist
- HR
- a lawyer
- a guaranteed promotion system
- an office-politics manipulation engine

WorkPA should:

- keep coaching data private
- cite source evidence
- ask approval before changing tasks/calendar/email
- make sensitive labels user-reviewed
- support deletion and retention controls
- phrase promotion support as evidence-building, not guarantees

## MVP

Build first:

- Career Profile
- Achievement Tracker
- Stakeholder Map v1
- Manager 1:1 Prep
- Weekly Work Coach Review
- Promotion Evidence Packet

Later:

- 360 feedback
- full GraphRAG
- LinkedIn/personal brand generation
- external job-search tooling
- team/enterprise manager views

## Source files in this repo

- `research/workpa-coach-feature-research-2026-05-15.md`
- `research/workpa-ai-wiki-backend-research-2026-05-15.md`
- `research/ai-pa-competitor-report-2026-05-13.md`
