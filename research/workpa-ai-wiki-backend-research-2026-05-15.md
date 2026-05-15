# WorkPA AI Wiki Backend Research

Date checked: 15 May 2026

Purpose: evaluate whether Andrej Karpathy's LLM Wiki pattern could act as the backend for WorkPA's growing personal work/career knowledge base, and compare alternatives.

## Short answer

Use the Karpathy LLM Wiki pattern as a compiled memory and context layer, not as the system of record.

For WorkPA, the safest architecture is:

- Canonical data in Postgres/Supabase.
- Raw sources in encrypted object storage.
- Search over raw sources and summaries using Postgres full-text search plus pgvector or a specialist vector database.
- A per-user AI-maintained wiki of Markdown-style summaries for long-term context.
- Optional graph projection for stakeholder/team/project relationships.

The wiki becomes the readable, compounding "what we currently know" layer. The database remains the authoritative backend for permissions, tasks, calendar events, stakeholders, achievements, audit logs, and user-reviewed facts.

## What Karpathy's LLM Wiki pattern is

Andrej Karpathy's April 2026 `llm-wiki` gist describes a pattern for personal knowledge bases. The core idea is that instead of doing retrieval-only RAG over raw documents every time, an LLM incrementally compiles raw sources into a persistent interlinked Markdown wiki.

The pattern has three layers:

- Raw sources: immutable source material.
- Wiki: LLM-generated Markdown pages that synthesize and cross-link knowledge.
- Schema: an instruction file such as `CLAUDE.md` or `AGENTS.md` that defines how the wiki is structured and maintained.

Operationally, the model ingests a source, writes or updates wiki pages, updates an index/log, and later answers questions against that maintained wiki. Good answers can be written back into the wiki so knowledge compounds.

This is very attractive for WorkPA because a user's work life becomes large and messy: meetings, tasks, emails, stakeholder notes, achievements, reflections, promotion evidence, and personal preferences.

## Why it is useful for WorkPA

The LLM Wiki pattern is useful because WorkPA needs memory that is:

- Human-readable.
- Easy for future AI sessions to load.
- Cross-linked across people, projects, meetings, goals, tasks, and achievements.
- Updated after meaningful events.
- Able to preserve synthesis, not just raw chunks.
- Versionable and auditable.

Example WorkPA wiki pages:

- `people/sarah-jones.md`
- `projects/q3-client-rollout.md`
- `career/promotion-target-senior-manager.md`
- `achievements/2026-q2-impact-log.md`
- `stakeholders/internal-map.md`
- `weekly-reviews/2026-05-15.md`
- `meetings/2026-05-15-product-review.md`
- `patterns/user-working-style.md`

The wiki is excellent context for AI outputs such as:

- "What should I bring up with my manager?"
- "What evidence do I have for promotion?"
- "Which stakeholder relationships need attention?"
- "What changed since last month?"
- "What actions came from recent meetings?"

## Why it should not be the backend by itself

A Markdown wiki alone is not enough for a production app.

Risks:

- No strong transactional guarantees.
- Harder permission and sharing model.
- Concurrency conflicts if multiple jobs update pages.
- AI can accidentally overwrite nuance unless changes are reviewed/versioned.
- Harder to query structured data such as deadlines, task status, attendee lists, and billing.
- Harder to enforce privacy, retention, and deletion at field level.
- Risk of hallucination propagation if generated summaries become treated as truth.

For WorkPA, the wiki should always reference raw source IDs and canonical database IDs. User-reviewed facts should be marked differently from AI-inferred facts.

## Recommended architecture

### Layer 1: Canonical operational database

Use Postgres, probably via Supabase if staying close to the current stack.

Stores:

- Users/accounts.
- OAuth connections.
- Calendar events.
- Email/thread metadata.
- Tasks.
- Meetings.
- Transcripts.
- Stakeholders.
- Achievements.
- Career goals.
- Promotion targets.
- Permissions.
- Audit logs.

This is the source of truth for app state.

### Layer 2: Raw source store

Stores immutable inputs:

- Meeting audio.
- Transcripts.
- Email snapshots or permitted excerpts.
- Calendar event payloads.
- Uploaded documents.
- User voice notes.
- Manager 1:1 notes.

Rules:

- Encrypted at rest.
- Strict per-user access.
- Retention controls.
- Deletable by user.
- Raw source ID attached to every generated fact.

### Layer 3: Search memory

Use hybrid retrieval.

Options:

- Supabase/Postgres full-text search plus pgvector.
- Qdrant for more advanced vector search.
- Weaviate for hybrid keyword/vector search and built-in RAG workflows.

For MVP, Postgres plus pgvector is likely enough. Supabase's AI docs position Postgres/pgvector as a way to store, index, and query embeddings, with semantic, keyword, and hybrid search options.

### Layer 4: Compiled per-user wiki

The AI-maintained wiki sits above raw search.

Responsibilities:

- Summarise durable facts.
- Maintain person/project/career pages.
- Keep "current understanding" up to date.
- Link to source IDs.
- Flag contradictions.
- Produce context packs for prompts.
- Preserve weekly/monthly narrative.

Store as:

- Markdown files in a per-user workspace, or
- Markdown rows in Postgres with version history, or
- Object storage plus DB metadata.

For a SaaS product, DB rows with version history are cleaner than raw files. For internal/dev use, files are easier.

### Layer 5: Optional graph projection

For stakeholder analysis, a graph is useful:

- People.
- Teams.
- Projects.
- Meetings.
- Tasks.
- Achievements.
- Relationships.
- Influence/support labels.

Options:

- Start with relational tables.
- Add graph-like queries in Postgres.
- Later add Neo4j or GraphRAG if relationship traversal becomes a core differentiator.

Microsoft Research describes GraphRAG as combining text extraction, network analysis, LLM prompting, and summarization. Neo4j describes GraphRAG as combining entity/relationship extraction with vector search for more explainable retrieval. This is promising for stakeholder networks, but probably too much for MVP.

## Backend alternatives

| Option | What it is | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Karpathy LLM Wiki only | Markdown wiki as main memory | Simple, readable, cheap, AI-friendly | Not robust enough for app state, permissions, queries, deletion, audit | Good for prototypes only |
| Postgres/Supabase only | Structured DB with text fields | Reliable app backend, permissions, existing ecosystem | Weak synthesis unless AI summaries/search added | Good base layer |
| Postgres + pgvector + wiki | Structured DB plus semantic search plus compiled Markdown memory | Best MVP balance: cheap, private, auditable, AI-friendly | Needs careful source linking and update jobs | Recommended |
| Specialist vector DB | Qdrant/Weaviate/Pinecone-style retrieval | Strong search, scaling, hybrid retrieval | Extra infrastructure, not source of truth | Add only if Postgres search is insufficient |
| Graph database | Neo4j/graph-first model | Strong for stakeholder maps and relationship reasoning | More complexity and operational cost | Later, if relationship graph becomes central |
| GraphRAG | LLM-derived graph plus retrieval | Better synthesis over connected narrative data | Costly and complex; hallucinated edges need review | Later research path |
| Notion/Obsidian-style wiki | User-readable external workspace | Great transparency/export | SaaS permissions and mobile UX harder | Useful export/integration, not primary backend |
| LangGraph long-term memory | Agent memory store | Good for agent frameworks | WorkPA should avoid always-on agent risk | Useful internally, not user-facing backend |

## Suggested WorkPA knowledge schema

Per-user wiki structure:

```text
wiki/
  index.md
  log.md
  user/
    profile.md
    working-style.md
    career-goals.md
  people/
    <person-id-name>.md
  teams/
    <team-name>.md
  projects/
    <project-name>.md
  meetings/
    yyyy-mm-dd-<meeting-title>.md
  achievements/
    index.md
    yyyy-q<quarter>-achievement-log.md
  coaching/
    promotion-plan.md
    weekly-reviews.md
    stakeholder-map.md
```

Every generated page should include frontmatter:

```yaml
owner_user_id:
page_type:
canonical_entity_ids:
source_ids:
last_compiled_at:
review_state: ai_draft | user_reviewed | stale
confidence:
```

## AI write rules

The AI may:

- Draft new wiki pages.
- Update summaries after meetings.
- Propose stakeholder/achievement updates.
- Flag contradictions.
- Link to raw sources.

The AI must not:

- Delete raw sources.
- Overwrite user-reviewed facts without creating a proposed change.
- Treat unsourced claims as fact.
- Update career-sensitive labels like "blocker" without evidence and user review.
- Send messages or calendar changes from wiki updates.

## Event-driven update model

Keep it low risk:

- After a meeting transcript is ready, compile meeting notes and proposed actions.
- After a weekly review, update promotion evidence and stakeholder notes.
- After user approves an achievement, update the achievement log.
- Before a 1:1, compile a manager brief.
- At user request, answer questions from the wiki and sources.

Avoid always-on background agents. Scheduled summarisation jobs are fine if visible, bounded, and reversible.

## MVP implementation path

1. Build canonical tables for stakeholders, achievements, career goals, and coaching sessions.
2. Add `source_events` for emails, meetings, tasks, and user notes.
3. Add `ai_facts` with source IDs, confidence, and review state.
4. Add wiki pages as DB rows or files.
5. Add a simple `index.md` generator per user.
6. Add embeddings for source snippets and wiki pages using pgvector.
7. Add a "compile career context" job after weekly review and meeting processing.
8. Add UI readback so users can inspect and correct the AI memory.

## Key product principle

The database owns truth. The wiki owns understanding. Search owns recall. The LLM owns drafting. The user owns approval.

## Sources

- Andrej Karpathy `llm-wiki` gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Karpathy Wiki guide site: https://karpathy-wiki.lol/en
- llm-wiki reference implementation overview: https://www.cognitionus.com/blog/llm-wiki-guide
- Denser.ai analysis of LLM Wiki: https://denser.ai/blog/llm-wiki-karpathy-knowledge-base/
- Supabase AI & Vectors: https://supabase.com/docs/guides/ai
- Supabase vector columns / pgvector: https://supabase.com/docs/guides/ai/vector-columns
- pgvector project: https://github.com/pgvector/pgvector
- Microsoft Research GraphRAG: https://www.microsoft.com/en-us/research/project/graphrag/overview/
- Neo4j GraphRAG: https://neo4j.com/labs/genai-ecosystem/graphrag/
- Qdrant: https://qdrant.tech/
- Weaviate hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- LangChain/LangGraph long-term memory: https://docs.langchain.com/oss/python/langchain/long-term-memory
