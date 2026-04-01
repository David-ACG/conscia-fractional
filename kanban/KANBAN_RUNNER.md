# Kanban Runner — Quality Gates Workflow

Structured workflow for taking tasks from idea through implementation with review gates at every stage transition.

## Project Configuration

- **Project:** FractionalBuddy.com (Fractional Executive OS)
- **Test Command:** `npm test` (Vitest)
- **Deploy Target:** Hetzner via Coolify at fractionalbuddy.com
- **Verification Method:** Playwright browser check
- **Beads Integration:** No
- **Linear Integration:** No

## Workflow

```
0_idea/   ──Claude──>  1_planning/   ──run-kanban.sh──>  2_testing/  ──review──>  3_done/
(rough      (craft       (plan + prompt    implement         (verify)     approved      (archived
 notes)     plan &       with review       test, verify      changes      w/ timestamp   w/ timestamp)
            prompts)     checklists)

  Gate 1: Plan Review      Gate 2: Prompt Review     Gate 3: Verify    Gate 4: Handoff
```

## Quality Gates

### Gate 1: Plan Review

After writing a PLAN file, Claude appends a timestamped review checklist to the end of the plan and asks David to review it with a clickable file link.

### Gate 2: Prompt Review

After writing PROMPT file(s), Claude appends a timestamped review checklist to the end of each prompt and asks David to review with clickable file links.

### Gate 3: Implementation Verification

After implementing a prompt, Claude runs tests, verifies with Playwright, and appends timestamped implementation notes to the end of the prompt file.

### Gate 4: Testing Handoff

After implementation, Claude appends a timestamped testing checklist to the prompt file — including an explicit **Actions for David** section that states exactly what David needs to do (or says "No actions required"). Then moves the file to `2_testing/` and tells David.

**Full gate specifications are in the global CLAUDE.md** (`~/.claude/CLAUDE.md` > Kanban Workflow section).

## File Naming Convention

All files MUST use: `PREFIX_YYYY-MM-DD_short-slug.md`

| Prefix      | Example                                                  |
| ----------- | -------------------------------------------------------- |
| `IDEA_`     | `IDEA_2026-03-25_fractionalbuddy.md`                     |
| `PLAN_`     | `PLAN_2026-03-25_fractionalbuddy-foundation.md`          |
| `PROMPT_`   | `PROMPT_2026-03-25_project-scaffold.md`                  |
| `RESEARCH_` | `RESEARCH_2026-03-25_fractionalbuddy-market-and-tech.md` |

## File Lifecycle

Files are **archived** (moved to 3_done/), never deleted:

1. **Idea** → archived to `3_done/` when planning is complete
2. **Plan** → archived to `3_done/` when all prompts from that plan are written
3. **Prompt** → moves `1_planning/` → `2_testing/` → `3_done/`

## Stage Folders

| Folder        | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `0_idea/`     | Rough notes — any `.md` file                                  |
| `1_planning/` | Plans and ready prompts — `PLAN_*.md` and `PROMPT_*.md` files |
| `2_testing/`  | Implemented — awaiting David's verification                   |
| `3_done/`     | Verified and archived — timestamped for audit trail           |

## Scripts

### `run-kanban.sh` — Execute tasks

```bash
cd C:\Projects\conscia-fractional
bash kanban/run-kanban.sh
```

Processes all `PROMPT_*.md` in `1_planning/` sequentially. Each gets a fresh Claude Code session. On success, the prompt file moves to `2_testing/`.

## Templates

- `PLAN_TEMPLATE.md` — Structure for plan files (includes Gate 1 placeholder)
- `PROMPT_TEMPLATE.md` — Structure for prompt files (includes Gate 2-4 placeholders)

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Auth:** Supabase Auth (OAuth + magic links)
- **Database:** Supabase PostgreSQL with Row Level Security
- **UI:** Tailwind CSS v4 + shadcn/ui + Radix UI + Lucide icons
- **Testing:** Vitest + Playwright
- **Code Quality:** ESLint 9, Husky, lint-staged, Commitlint
- **Hosting:** Hetzner via Coolify
