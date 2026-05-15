# Claude Code Prompt: Independent WorkPA + Work Coach Research

Use this prompt in Claude Code to produce an independent research pack for comparison against Codex research.

## Prompt to paste into Claude Code

You are Claude Code working in the repo at:

```text
C:\Projects\conscia-fractional
```

I want you to do independent product research and create Markdown research files. This is deliberately for comparison against separate Codex research, so keep your work separate and do not read, summarize, modify, or rely on any existing Codex-created WorkPA research files.

Important separation rules:

- Do not open or use these existing Codex research files as source material:
  - `research/ai-pa-competitor-report-2026-05-13.md`
  - `research/workpa-coach-feature-research-2026-05-15.md`
  - `research/workpa-ai-wiki-backend-research-2026-05-15.md`
  - `research/workpa-coach-context-brief-2026-05-15.md`
- You may inspect `AGENTS.md` and repo workflow files only as needed to follow local conventions.
- Produce your own independent research from the product brief below and current web sources.
- Put all Claude outputs under a clearly separate folder:

```text
research/claude-workpa-comparison/
```

Create that folder if needed.

## Product brief

The product working name is **WorkPA**.

It started as an idea for a service similar to Fractional Buddy, but for individual employees who have one main job and need an AI PA to help with admin. The app would connect to the user's primary business email, calendar, tasks, and meeting information.

Core PA jobs:

- Make sure the user is not missing important emails.
- Help the user prepare for meetings.
- Track commitments and follow-ups from email and meetings.
- Plan tasks against the user's real calendar.
- Warn if the user is not on track before a deadline.
- Give a daily morning briefing.
- Show a daily dashboard with calendar, tasks, progress, meeting prep, and risks.

Desk/tablet concept:

- User has a cheap Android tablet on their desk.
- Each morning, the tablet tells them what meetings and tasks they have.
- The user can correct/update the plan using speech.
- The app then creates a daily plan using calendar data plus user corrections.
- The tablet shows a dashboard for the day: calendar, tasks, useful info, progress, remaining work, and deadline risk.
- It must be low-risk and low-cost.
- It should do specific things at specific times or when requested, not run as an always-on autonomous agent.

Meeting recording concept:

- During in-person or remote meetings, the user can tap a button on the tablet to record.
- This avoids needing a meeting bot to join the call.
- It should work in an office or at home if the tablet can hear the speaker/audio.
- After recording, it transcribes, summarizes, extracts decisions, tasks, owners, dates, and follow-ups.
- It should behave like the Fractional Buddy meeting pipeline, but for an individual worker.
- Caveats to consider: headphones, audio splitters, speaker diarisation, optional tap-to-identify speaker chips using attendees from the calendar invite.
- Include consent reminder, visible recording state, private/encrypted/deletable recordings, and retention controls.

Work coach expansion:

The app should also act as a kind of work coach to help users improve at work and get promoted.

Desired coach functionality:

- Team structure mapping.
- Internal and external stakeholder analysis.
- Stakeholder relationship tracking.
- Achievement tracker.
- Suggestions for useful achievements that could support a promotion case.
- Manager 1:1 prep.
- Performance review/promotion evidence prep.
- Weekly reflection and coaching review.
- Communication and leadership practice.
- The coach should help users build evidence, influence, visibility, and stakeholder relationships without becoming manipulative or risky.

User preference:

- The app must feel safe, low-risk, and bounded.
- Avoid OpenClaw-style risky autonomous behaviour.
- Prefer user-triggered actions, scheduled briefings, draft/propose/review/apply workflows, and explicit approval.
- Do not assume users can bring ChatGPT/Claude/Codex subscriptions to power the app; research whether API use is needed if relevant, but focus mainly on product and backend research.

Domain notes:

- `workpa.co.uk` and `workpa.ai` were found available by the user.
- WorkBuddy, WorkBud, and personalassistant.co.uk were found taken.

## Research tasks

Please research from current web sources, primary sources where possible, and cite links in the Markdown files.

### 1. Competitive Landscape

Research services that overlap with WorkPA:

- AI executive assistants.
- AI email assistants.
- AI calendar/task planners.
- AI meeting recorders/transcribers.
- AI daily planner/dashboard apps.
- AI career coaches.
- Achievement trackers/brag document tools.
- Coaching platforms.
- Stakeholder/team mapping tools if relevant.

For each useful competitor, capture:

- Name.
- URL.
- Category.
- Current pricing if available.
- Core functionality.
- How similar it is to WorkPA.
- Weaknesses or gaps.
- What WorkPA can do better.

Do not limit yourself to competitors already known. Find fresh ones.

### 2. Product Strategy

Work out:

- The clearest product positioning.
- The strongest wedge.
- The best MVP.
- Which features should be first versus later.
- What should be excluded to keep it low-risk.
- Whether the tablet/desk mode is a differentiator.
- Whether the meeting recorder is a core feature or a later add-on.
- How the PA and coach parts should fit together.

### 3. Work Coach Research

Research what life coaches, career coaches, executive coaches, and leadership coaches actually do.

Turn that into product features:

- Goal setting.
- Accountability.
- Reflection.
- Values/purpose clarification.
- Career progression.
- Promotion planning.
- Stakeholder management.
- Communication practice.
- Confidence/executive presence.
- Managing burnout/work-life balance boundaries, while avoiding therapy claims.
- 360 feedback or manager feedback.
- Performance review preparation.
- Negotiation/promotion conversations.

Find useful frameworks:

- GROW.
- STAR.
- Stakeholder power/interest matrix.
- 360 feedback.
- Career development frameworks.
- Any other frameworks worth turning into product UX.

### 4. Achievement Tracker

Research and design an achievement tracker that helps users get promoted.

Include:

- What data should be captured.
- How achievements can be detected from tasks, emails, meetings, and user notes.
- How to structure achievements for performance reviews and promotion packets.
- How to suggest "next useful achievements" based on gaps.
- How to avoid encouraging performative or manipulative behaviour.
- How to help users communicate impact without bragging awkwardly.

### 5. Stakeholder and Team Structure

Design a feature set for:

- Team/org map.
- Stakeholder register.
- Internal vs external stakeholders.
- Influence, interest, support, relationship quality, last contact, next action.
- Stakeholder-specific briefing before meetings.
- Sponsor/mentor/champion tracking for promotion.
- Ethical boundaries.

### 6. Backend and Knowledge Architecture

The amount of data may become large: emails, meetings, transcripts, tasks, achievements, stakeholders, career goals, and coach notes.

Research Andrej Karpathy's **LLM Wiki** / AI-powered wiki idea and evaluate whether it could be the backend or memory layer for WorkPA.

Answer:

- What is the LLM Wiki pattern?
- Is it real and current?
- What problem does it solve?
- Would it work as the primary backend?
- Where would it fail?
- How could WorkPA use it safely?
- What are the alternatives?

Compare with:

- Postgres/Supabase.
- pgvector / vector search.
- Traditional RAG.
- Hybrid search.
- Knowledge graphs / GraphRAG.
- Neo4j or other graph DBs.
- Qdrant/Weaviate/Pinecone-style vector DBs.
- Notion/Obsidian-style user-facing wiki.
- LangGraph or agent memory approaches.

Give a practical architecture recommendation for a low-risk SaaS MVP.

### 7. Safety, Privacy, and Trust

Research and recommend:

- Consent and recording rules.
- Private/encrypted/deletable recordings.
- OAuth/email/calendar permission minimisation.
- Source citations and audit trails.
- User approval before sending emails or changing calendars.
- Sensitive coaching data privacy.
- Retention policies.
- Boundaries: not therapy, not HR, not legal advice, not guaranteed promotion.
- How to avoid risky autonomous agent behaviour.

### 8. Pricing and Commercial Model

Suggest pricing:

- Solo user.
- Pro user.
- Business/teams later.
- Hardware/tablet positioning if relevant.
- API cost considerations if using LLMs, transcription, embeddings, storage.

### 9. Naming and Domains

Evaluate `WorkPA`, `workpa.ai`, and `workpa.co.uk`.

Suggest alternative names/domains if useful, but do not spend too much time here.

## Deliverables

Create these files:

```text
research/claude-workpa-comparison/claude-workpa-competitor-landscape-2026-05-15.md
research/claude-workpa-comparison/claude-workpa-product-strategy-2026-05-15.md
research/claude-workpa-comparison/claude-workpa-coach-features-2026-05-15.md
research/claude-workpa-comparison/claude-workpa-backend-architecture-2026-05-15.md
research/claude-workpa-comparison/claude-workpa-safety-privacy-2026-05-15.md
research/claude-workpa-comparison/claude-workpa-context-brief-2026-05-15.md
```

The context brief should be short and useful for future sessions. The other files can be more detailed.

## Quality bar

- Use current web research and include source links.
- Prefer official/vendor docs for pricing and product capability.
- Distinguish facts from your recommendations.
- Be opinionated, not just descriptive.
- Include practical implementation implications.
- Keep the research independent from Codex's existing research.
- Do not modify source code.
- Do not overwrite existing research files outside `research/claude-workpa-comparison/`.
- Commit only your new Claude comparison research files.

## Final response

When finished, tell me:

- Which files you created.
- The top 5 conclusions.
- Any areas where sources were weak or uncertain.
- The commit hash if you committed.
