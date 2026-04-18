# Research: Exporting FractionalBuddy Tasks to Trello

**Date:** 2026-04-17
**Author:** David (with Claude)
**Purpose:** Decide the most efficient, low-friction way to push FractionalBuddy tasks into a Trello board so client-facing work can be tracked where clients already live.

---

## 1. Current state — FractionalBuddy tasks

| Aspect | Detail |
|--------|--------|
| Tasks table | `tasks` (Supabase) — see `supabase/migrations/001_initial_schema.sql:95-115` |
| Key fields | `title`, `description`, `status` (`todo` \| `in_progress` \| `blocked` \| `done`), `priority` (`low` \| `medium` \| `high` \| `urgent`), `assignee`, `assignee_type`, `due_date`, `crm_customer_id`, `meeting_id`, `is_client_visible` |
| UI | `src/components/tasks/task-list.tsx` — list + kanban view with filter, sort, consolidation |
| Server actions | `src/lib/actions/tasks.ts` — `createTask`, `updateTask`, `deleteTask`, `updateTaskStatus` |
| Integrations pattern | `src/lib/services/integration-service.ts` — encrypted token store in `integrations` table (AES-256-GCM) |

All server actions use `createAdminClient` (bypasses RLS). This project convention applies to the Trello export too.

---

## 2. Options evaluated

### Option A — Trello REST API (direct, server-side)
- **Auth:** Personal API key + token (Trello's "delegated auth" flow) *or* OAuth 1.0a. Trello does **not** support OAuth 2.0.
- **Endpoints used:** `GET /1/members/me/boards`, `GET /1/boards/{id}/lists`, `POST /1/cards`
- **Pros:** Simple, no third party, full control of field mapping, works in Node.
- **Cons:** Must handle rate limits (100 req/10s per token, 300 req/10s per key). Custom fields require a second `PUT` per card.

### Option B — Zapier / Make / n8n webhook
- **Pros:** No code on our side beyond POSTing a webhook.
- **Cons:** External dependency, monthly cost per workflow, lag, harder to debug, data leaves our stack. Poor fit for a product feature.

### Option C — Trello CSV import (Board Export Power-Up in reverse)
- **Pros:** Zero-integration. User downloads CSV, uploads via Trello Power-Up.
- **Cons:** Trello's native import is limited — no status-to-list routing, no labels, no due-date parsing from arbitrary columns. Two-step manual workflow.

### Option D — Unito / Productboard-style two-way sync
- **Pros:** Rich field mapping, keeps boards in sync.
- **Cons:** Massive scope (webhooks, conflict resolution, polling). Out of proportion for current need.

### **Recommendation: Option A — direct REST API**
Matches our existing integration pattern (Slack, Google). One-way export initially; we can layer two-way sync later if demand appears.

---

## 3. Trello API — what matters for us

### Authentication

Trello gives us two viable paths:

| Method | UX | Complexity | Verdict |
|--------|----|------------|---------|
| **API Key + User Token** (delegated) | User visits `https://trello.com/1/authorize?...&response_type=token&key={key}` and pastes token back | Low — no callback handler, no state, no PKCE | ✅ **Recommended for v1** |
| **OAuth 1.0a** | Full redirect flow with request/access tokens, HMAC-SHA1 signing | High — no OAuth 2 library fits, Trello's 1.0a is bespoke | ❌ Defer |

**Security:** The API key is public-safe. The token grants full account access and must be encrypted at rest (use our existing `encryption.ts`). Token expiration is configurable — we'll request `expiration=never` scoped to `read,write` on the user's boards.

**Flow:**
1. User enters **Trello API key** (public — from `https://trello.com/app-key`) in Settings.
2. We generate authorize URL: `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=FractionalBuddy&key={key}&return_url={redirect}`
3. User grants access. Trello redirects to our callback with `?token=...` in query.
4. We encrypt and store both key + token in `integrations` (`provider='trello'`).

This avoids OAuth 1.0a entirely. Total surface: 1 settings form + 1 callback route.

### Creating cards — `POST /1/cards`

| Param | Required? | Maps to task field |
|-------|-----------|---------------------|
| `idList` | ✅ | derived from status via user-defined mapping |
| `name` | — | `title` |
| `desc` | — | `description` + `assignee` + `priority` + link back to FB |
| `due` | — | `due_date` (ISO 8601) |
| `idLabels` | — | priority → label colour |
| `pos` | — | `"top"` or `"bottom"` |

**Custom fields:** Trello does *not* accept custom-field values in the card-create call. Would require one extra `PUT /1/cards/{id}/customField/{idCustomField}/item` per field. **Decision: skip for v1** — stash priority + assignee in the card description. Revisit if users ask.

### Rate limits (per Trello docs)

- **100 requests / 10 sec per token**
- 300 requests / 10 sec per API key
- 429 response on breach with `API_TOKEN_LIMIT_EXCEEDED`
- If >200 429s in 10s, key is cooled for the remainder of the interval

**Our strategy:**
- Throttle to **≤8 cards/second** (80 req/10s — 20% headroom).
- Implement with a simple `p-limit`-style queue or `await setTimeout(125)` between calls.
- On 429, exponential backoff with `Retry-After` header if present.
- Surface progress to the UI (e.g. "Exporting 12/47 tasks…").

### Status → list mapping

Typical Trello boards use "To Do / Doing / Done" columns. We let the user pick a board, then show each of our four statuses (`todo`, `in_progress`, `blocked`, `done`) with a dropdown to select the destination list. Defaults attempt fuzzy match on list name:

| FB status | Matches (case-insensitive `includes`) |
|-----------|---------------------------------------|
| `todo` | "to do", "todo", "backlog", "inbox" |
| `in_progress` | "doing", "in progress", "wip" |
| `blocked` | "blocked", "waiting", "on hold" |
| `done` | "done", "complete", "shipped" |

User overrides defaults if needed.

---

## 4. How others do it (reference patterns)

- **Productboard** — lets user pick board, maps their "feature states" → Trello lists; colour-coded status values. Confirms our mapping UX is standard.
- **Unito** — full two-way sync with mapping rules per field. Overkill for us; good reference for v2.
- **Board Export Power-Up** (by Trello themselves) — CSV in both directions. We can later support CSV *import* side if customers want offline editing.
- **n8n Trello node** — uses API key + token auth, confirms that pattern is the community default for server-side integrations.

---

## 5. Scope for v1

**In:**
- Connect Trello via API key + delegated token (encrypted in `integrations`).
- Settings UI: connect / disconnect / show connected account.
- "Export to Trello" action on the Tasks page.
- Dialog: pick board → pick list per status → preview count → export.
- Throttled creation with progress UI.
- Each card's description ends with `— Exported from FractionalBuddy [link to task]`.

**Out (v2+):**
- Two-way sync (webhooks).
- Custom fields (priority, assignee, due complete) as native Trello custom fields.
- Label creation / colour sync.
- Multiple Trello accounts per user.
- Bulk updates after initial export.

---

## 6. Risk / open questions

| Risk | Mitigation |
|------|------------|
| User re-exports and creates duplicates | Store `trello_card_id` on task (new column) after first export; dialog shows "already exported — skip / re-create / update" |
| 429 rate-limit errors on large batches | Throttle + retry with backoff |
| Token leakage | AES-256-GCM via existing `encryption.ts`; never log token |
| User revokes Trello token externally | Catch 401, mark integration inactive, surface re-connect prompt |

---

## 7. Decision

**Build Option A (direct REST API) with API key + delegated token.**
One-way export only for v1. Three prompt-sized slices:

1. **Trello auth + settings UI** — connect/disconnect, store encrypted token.
2. **Trello export service + server action** — list boards, list lists, create cards with throttling. Add `trello_card_id` migration.
3. **Export dialog UI + Playwright test** — the "Export to Trello" user journey end-to-end.

Unit tests per service; Playwright test covers the full UI export flow against a mocked Trello API.

---

## Sources

- [Trello REST API — Cards](https://developer.atlassian.com/cloud/trello/rest/api-group-cards/)
- [Authorizing With Trello's REST API](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/)
- [Trello Rate Limits](https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/)
- [Trello Custom Fields guide](https://developer.atlassian.com/cloud/trello/guides/rest-api/getting-started-with-custom-fields/)
- [n8n — Trello credentials docs](https://docs.n8n.io/integrations/builtin/credentials/trello/)
- [Productboard — Trello integration status mapping](https://support.productboard.com/hc/en-us/articles/360058177573-Integrate-with-Trello)
