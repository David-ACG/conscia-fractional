# AI PA Competitor Report

Date checked: 13 May 2026

Working concept: a lightweight AI personal assistant for people with one main job. It connects to the user's primary work email, calendar, and task list, then keeps them on top of email, meeting preparation, follow-ups, commitments, and deadline risk.

## Executive summary

There is a real gap between "AI email tools", "AI calendar planners", "meeting note tools", and broad enterprise AI suites. Most products solve one slice well, but very few act like a reliable PA that understands the full work loop: email asks become tasks, tasks get planned against calendar capacity, meetings are briefed from the right threads and documents, and the user can see whether they are on track before a deadline fails.

The strongest wedge is not "another AI inbox" or "another auto-scheduler". The strongest wedge is a proactive work-control layer:

- "Nothing slips": detect commitments, unanswered important emails, delegated follow-ups, meeting prep needs, and looming deadline risk.
- "Am I on track?": turn tasks into a time plan, compare the plan with actual calendar capacity, and explain risk early.
- "Ready for meetings": produce a pre-meeting brief with prior emails, open actions, relevant files, likely decisions, and suggested questions.
- "Trustworthy PA mode": draft-first actions, citations back to source emails/events/tasks, audit trail, approval controls, and easy undo.

Pricing context suggests a solo professional product can sit around GBP 15-30/month or USD 19-35/month if it has clear cross-email/calendar/task value. A higher tier around GBP 39-59/month can be justified if it includes inbox triage, meeting briefs, follow-up drafts, and proactive deadline forecasting. The low-price Duly/MyHandler segment is interesting, but trust and depth matter more than racing to USD 7/month.

## Market map

| Segment | What they solve | Why they matter | Core weakness for this product opportunity |
| --- | --- | --- | --- |
| AI executive assistants and agents | Proactive email, commitments, workflows, task execution | Closest direct competitors | Often early-stage, narrow trust model, limited task planning, or credit/automation complexity |
| AI calendar/task planners | Auto-schedule tasks into calendar capacity | Strongest "on track before deadline" precedent | Usually rely on user-entered tasks and do not truly read inbox/meeting context |
| AI email clients and inbox tools | Faster triage, summarization, drafting, labels, reminders | Own the user's highest-friction daily surface | Email-first, not a full PA; weak task capacity and project deadline modelling |
| Meeting assistants | Notes, summaries, action items | Useful for meeting readiness and follow-up | Mostly post-meeting, not pre-meeting, and weak on inbox/task context |
| Microsoft/Google suite AI | Native email/calendar/docs AI inside existing work suites | Distribution, trust, IT comfort | Broad, reactive, and app-bound; not a single accountable PA workflow |

## Competitor table

Pricing is public list pricing from official pages where possible. Currency follows the vendor page observed.

| Product | Category | Current public pricing | Useful capabilities | Weakness we can exploit | Link |
| --- | --- | --- | --- | --- | --- |
| Duly | AI executive assistant | USD 7/month after 7-day trial | Tracks commitments, delegated tasks, daily briefing, email/Teams focus | Very low price creates credibility/support questions; positioning is mostly commitments and email, not deep calendar capacity planning | [getduly.ai](https://getduly.ai/) |
| Jace AI | AI email/calendar assistant | Plus USD 25/month or USD 20/month annual; Pro USD 50/month or USD 40/month annual | Connects inboxes/calendars, drafts replies, labels email, searches email history, credits model | Credit-based, email-led, unclear deadline planning depth | [jace.ai/pricing](https://jace.ai/pricing) |
| MyHandler | Private AI assistant | Free; Personal USD 15/month; Business USD 29/month; Executive USD 59/month, waitlist/early access | Email, meetings, screen, files, local-first privacy story, many channels | Early/waitlist risk; broad promise may be hard to operationalize; less focused on single-job admin workflow | [myhandler.ai](https://myhandler.ai/) |
| Saner.AI | AI productivity assistant | Free; Starter USD 8/month; Standard USD 16/month | Notes, tasks, Google Drive, email, Slack, calendar sync; ADHD-friendly positioning | More "second brain" than PA; not clearly email-led or deadline-risk-led | [saner.ai/pricing](https://saner.ai/pricing/) |
| Lindy | AI agent platform | Plus USD 49.99/month; Pro USD 99.99/month; Max USD 199.99/month; custom enterprise | Build agents across apps, email/calendar workflows, broad automation | Powerful but builder-oriented; high cognitive load for a solo employee who wants an assistant, not an automation platform | [lindy.ai/pricing](https://www.lindy.ai/pricing) |
| Fyxer AI | AI executive assistant | Starter USD 30/month or USD 22.50 annual; Professional USD 50/month or USD 37.50 annual; Enterprise custom | Inbox triage, draft replies, meeting notes, assistant-style support | Premium email assistant more than full task/deadline operating system | [fyxer.com/pricing](https://www.fyxer.com/pricing) |
| Reclaim.ai | AI calendar/task planner | Free Lite; Starter USD 10/month annual or USD 12 monthly; Business USD 15 annual or USD 18 monthly; Enterprise USD 22 annual | Auto-schedules tasks, habits, focus time, smart meetings, calendar sync, task integrations | Great calendar intelligence but weak email understanding and meeting brief generation | [reclaim.ai/pricing](https://reclaim.ai/pricing) |
| Motion | AI calendar/task/project planner | Pro AI USD 19/user/month annual; Business AI USD 29/user/month annual; monthly prices higher | Auto-plans tasks and projects into calendar, priorities, team planning | Can feel like a new task/project system; email and meeting readiness are secondary | [usemotion.com/pricing](https://www.usemotion.com/pricing) |
| Akiflow | Task/calendar command center | Pro Monthly USD 34/month; Pro Yearly USD 19/month billed yearly | Unified tasks, calendar, integrations, meetings, AI executive assistant "Aki" | Strong for power users, less "do this for me"; user still manages the system | [akiflow.com/pricing](https://akiflow.com/pricing) |
| Sunsama | Daily planner | Pro USD 17/month annual or USD 22 monthly | Guided daily planning, integrations, AI/MCP/Zapier, calm planning workflow | Manual daily planner, not a proactive inbox/calendar PA | [sunsama.com/pricing](https://sunsama.com/pricing) |
| SkedPal | Auto-scheduler | Individual USD 14.95 monthly or USD 9.95 annual | Time maps, auto-scheduling tasks into available time | Older/planner-heavy feel; not an email or meeting assistant | [skedpal.com/pricing](https://www.skedpal.com/pricing/) |
| FlowSavvy | Auto-scheduling planner | Free; Pro USD 14 monthly or USD 10 annual | Auto-rescheduling, overcommitment warnings, deadlines, task dependencies | Strong deadline mechanic, but little/no email intelligence or meeting prep | [flowsavvy.app/pricing](https://flowsavvy.app/pricing) |
| Todoist | Task manager with AI assist | Free; Pro USD 7/month or USD 5/month annual; Business USD 10/user/month or USD 8/user/month annual after the Dec 2025 pricing update | Mature tasks, deadlines, calendar layout, Task Assist, Email Assist, integrations | Task database only; not a PA unless the user manually maintains it | [todoist.com pricing](https://www.todoist.com/pricing), [pricing update](https://www.todoist.com/help/articles/todoist-pricing-and-plans-update-2025-everything-you-need-to-know-Tn6Pg1JKI) |
| Superhuman Mail | AI email client | Starter USD 25/user/month; Business USD 33/user/month; Enterprise custom | Fast email, AI writing, instant replies/events, auto labels, reminders, summaries | Premium inbox, not calendar capacity planning or task execution | [superhuman.com/pricing](https://superhuman.com/pricing) |
| Shortwave | AI email client | Business USD 24/seat/month annual; Premier USD 36; Max USD 100; Enterprise custom | AI email search, AI filters, summaries, todos, scheduling email help, AI integrations | Strong inbox layer, but tasks remain email-bound; no full work plan or deadline risk model | [shortwave.com/pricing](https://www.shortwave.com/pricing/) |
| SaneBox | Email filtering | Publicly reported Snack/Lunch/Dinner tiers around USD 7/12/36 monthly; 14-day trial | Priority filtering, reminders, no-reply tracking, low-touch email cleanup | Header/filtering heritage; no deep semantic PA or calendar/task planning | [sanebox.com/pricing](https://www.sanebox.com/pricing/) |
| Mailbutler | Email productivity add-on | Free Starter; Professional USD 9 monthly or USD 7 annual; Smart USD 14 monthly or USD 11 annual; Business custom | Email tracking, smart follow-ups, AI compose, smart task finder, notes/tasks | Add-on features inside email, not a unified work cockpit | [mailbutler.io/pricing](https://www.mailbutler.io/pricing/) |
| Fireflies.ai | Meeting assistant | Free; Pro USD 10/seat/month annual; Business USD 19 annual; Enterprise USD 39 annual | Transcription, summaries, AskFred, action items, integrations | Mostly post-meeting intelligence; weak pre-meeting readiness from email/task context | [fireflies.ai/pricing](https://fireflies.ai/pricing) |
| Otter.ai | Meeting assistant | Free Basic; Pro USD 8.33/user/month annual or USD 16.99 monthly; Business USD 19.99 annual or USD 30 monthly | Meeting notes, AI chat, workflows, templates, action items | Meeting-only center of gravity; not an inbox/calendar PA | [otter.ai/pricing](https://otter.ai/pricing) |
| Microsoft 365 Copilot Business | Suite AI | Microsoft page observed from USD 18/user/month annual promo, USD 21 original, or USD 25.20 monthly commitment; requires qualifying Microsoft 365 plan | Outlook, Teams, Office apps, search, agents, enterprise security | Deep in Microsoft stack but reactive and broad; does not naturally become a personal accountability layer | [microsoft.com/microsoft-365-copilot/business](https://www.microsoft.com/en-us/microsoft-365-copilot/business) |
| Google Workspace with Gemini | Suite AI | UK page observed Starter GBP 5.90/user/month annual, Standard GBP 11.80, Plus GBP 18.40; Gemini features vary by tier | Gemini in Gmail, Docs, Meet, Drive, Calendar ecosystem | Native but general-purpose; no independent commitment ledger or deadline risk model | [workspace.google.com/pricing](https://workspace.google.com/pricing.html) |
| Clockwise | AI calendar optimizer | Product no longer available from 27 Mar 2026 after Salesforce acquisition | Previously focus-time and meeting optimization | Shutdown creates migration pain and validates the category while leaving a trust gap | [getclockwise.com](https://www.getclockwise.com/) |

## Weakness patterns

1. Manual task capture is still the norm.

Calendar planners are good once tasks exist, but most work arrives as emails, meeting comments, Slack/Teams messages, and vague promises. The user still has to convert that mess into clean tasks with due dates and estimates. A PA should extract commitments automatically, ask for confirmation only when needed, and keep the original evidence attached.

2. Email tools stop at the inbox.

Superhuman, Shortwave, Mailbutler, Jace, Fyxer, SaneBox, and Duly all attack email overload. The weakness is what happens after an email is understood. Most do not turn a "please send the deck by Friday" thread into a capacity-aware plan, hold time for it, warn when meetings destroy the plan, and prepare the user for the related meeting.

3. Meeting tools mostly work after the meeting.

Fireflies and Otter produce notes and action items, but the bigger pain is before the meeting: "What is this meeting for, what did I promise last time, what emails did I miss, what should I decide, and what should I ask?" A meeting-ready PA can win by briefing before the call, not just summarizing after it.

4. Enterprise suites are powerful but not accountable.

Microsoft Copilot and Google Gemini are embedded where users already work. They can summarize and draft, but they generally wait for prompts and stay inside app boundaries. The opportunity is a system that owns the recurring PA routine: check inbox, update commitments, inspect calendar, build the work plan, warn about deadline risk, and brief meetings.

5. Agent platforms are too configurable.

Lindy and similar tools are powerful for people who like building automations. A busy employee often wants a default operating model that works on day one. The product should sell "your PA is already trained in the basics of work admin", with optional customization later.

6. Trust is the adoption bottleneck.

Primary work email is sensitive. The product will need a more careful posture than a consumer AI app: source citations, approval gates, draft-first actions, reversible changes, minimal OAuth scopes, clear data retention, no model training on customer data, and ideally UK/EU privacy positioning.

## How our app can be more powerful

### 1. Create a commitment ledger

The app should continuously identify:

- Promises the user made.
- Requests made of the user.
- Tasks the user delegated to others.
- Important unanswered emails.
- Meeting actions and decisions.
- Date phrases and implied deadlines.
- Dependencies and blockers.

Every item should include source links back to the original email/thread/event/note and a confidence level. This makes the AI feel accountable rather than magical.

### 2. Build a deadline risk engine

For each task, the app should track:

- Deadline or target date.
- Estimated effort.
- Remaining effort.
- Required prep/review time.
- Calendar capacity before the deadline.
- Competing commitments.
- Risk level: on track, tight, at risk, impossible.

The differentiator is not just auto-scheduling. It is explaining why something is at risk and what needs to move.

Example output:

> "The Q2 forecast is due Friday 15:00. You have 2.5 hours of free focus time before then, but the task is estimated at 4 hours and needs Sarah's figures. Risk: at risk. Suggested fix: ask Sarah by 11:00 today and hold 90 minutes tomorrow morning."

### 3. Make meeting readiness a daily habit

For every upcoming meeting, generate a brief:

- Purpose and likely agenda.
- Who is attending and why they matter.
- Relevant recent email threads.
- Previous meeting actions and whether they were done.
- Open tasks related to attendees or project.
- Files likely to be needed.
- Suggested talking points and questions.
- Decisions to push for.

This is a strong emotional benefit: the user arrives prepared even when the week is chaotic.

### 4. Make email triage outcome-led

Instead of "summarize this email", the app should ask:

- Does this require a reply?
- Does this create a task?
- Does this affect a deadline?
- Does this affect a meeting?
- Does this need a calendar hold?
- Can a draft reply be prepared?
- Can it be safely archived?

That turns inbox processing into work control.

### 5. Provide a daily PA briefing

A daily briefing should be the product's core screen/email:

- Top priorities today.
- Meetings requiring prep.
- Emails that need attention.
- Deadlines at risk.
- Work blocks already protected.
- Follow-ups owed by others.
- Draft replies waiting for approval.

The report should be short enough to read in 90 seconds, with drill-down for evidence.

### 6. Respect user agency

The assistant should start conservative:

- Draft but do not send.
- Suggest but do not move meetings.
- Create proposed tasks for approval.
- Show source citations.
- Learn preferences from user corrections.

Power users can later enable higher-autonomy modes: auto-label, auto-archive, auto-create low-risk tasks, auto-hold focus blocks, auto-send simple nudges.

## Product positioning

Best positioning:

> "An AI PA for your workday. It watches your email, calendar, and tasks so you know what matters, what is at risk, and what to do next."

Alternative sharper versions:

- "The AI PA that stops work from slipping through the cracks."
- "Your inbox, calendar, and tasks, turned into a plan."
- "Know what needs your attention before it becomes urgent."
- "A personal chief of staff for ordinary workdays."

Avoid leading with generic "AI productivity". The category is crowded. Lead with "AI PA" and concrete outcomes: not missing emails, being ready for meetings, and staying on track before deadlines.

## MVP recommendation

The MVP should focus on Google Workspace and Microsoft 365 email/calendar integrations, not every task app.

Priority features:

1. Connect Gmail/Outlook and Google/Microsoft Calendar.
2. Daily PA briefing.
3. Important email detection and reply-needed queue.
4. Commitment extraction from email.
5. Task planner with deadline, estimate, status, and calendar-capacity risk.
6. Meeting readiness brief for upcoming meetings.
7. Draft replies and follow-up nudges.
8. Source citations and approval workflow.

Do not start with:

- Full autonomous sending.
- Too many integrations.
- Team dashboards.
- CRM workflows.
- Generic agent-builder features.

The product should feel like "my PA is watching the important stuff" before it becomes "my automation platform".

## Pricing recommendation

Suggested launch tiers:

| Tier | Price | Included | Reasoning |
| --- | --- | --- | --- |
| Free or Trial | 14 days free, no card if possible | Connect inbox/calendar, limited briefing, limited meeting briefs | Lets users feel the value with their real work data |
| Solo | GBP 15-19/month or USD 19/month | Daily briefing, email triage, basic commitments, meeting briefs, task risk | Competitive with Sunsama/Reclaim/FlowSavvy but broader |
| Pro PA | GBP 29-39/month or USD 35-49/month | Unlimited briefs, draft replies, follow-up tracking, calendar holds, advanced risk planning | Competes with Superhuman/Fyxer/Shortwave on outcome, not just email |
| Business | GBP 59+/user/month or custom | Admin controls, retention, security, audit logs, shared assistant patterns | For users expensing through work or small teams |

The likely sweet spot is a single Pro plan around GBP 29/month with a strong trial. Underpricing at USD 7/month may make the product look less trustworthy for primary work email unless the product is deliberately low-touch and self-serve.

## Domain and naming options

### Best current option

WorkPA is strong if both `workpa.co.uk` and `workpa.ai` are genuinely available. It is short, clear, and very UK-friendly. The main risk is that "PA" is less immediately obvious in the US than in the UK, so the homepage tagline needs to explain it instantly.

Recommended brand architecture:

- Primary: `workpa.ai`
- UK trust/local market: `workpa.co.uk`
- Tagline: "Your AI PA for email, calendar, and tasks."

### Strong alternatives to check

| Name | Domains to check | Why it works | Caveat |
| --- | --- | --- | --- |
| DeskPA | deskpa.ai, deskpa.co.uk | Clear work/admin feel | Slightly office-bound |
| InboxPA | inboxpa.ai, inboxpa.co.uk | Strong email wedge | May understate calendar/tasks |
| TaskPA | taskpa.ai, taskpa.co.uk | Strong deadline/task wedge | May understate email |
| ReadyPA | readypa.ai, readypa.co.uk | Meeting readiness and preparedness | Less literal |
| OnTrackPA | ontrackpa.ai, ontrackpa.co.uk | Perfect for deadline risk | Longer |
| WorkReady | workready.ai, workready.co.uk | Meeting/task preparedness | More generic HR/training feel |
| DayPilot | daypilot.ai, daypilot.co.uk | Daily planning and control | "Pilot" and "Copilot" space is crowded |
| Briefed | briefed.ai, briefed.co.uk | Meeting readiness, email summaries | Narrower than full PA |
| WorkBrief | workbrief.ai, workbrief.co.uk | Daily/meeting briefs | Could sound like a newsletter |
| AdminPilot | adminpilot.ai, adminpilot.co.uk | Explains admin automation | "Pilot" may feel derivative |
| WorkNudge | worknudge.ai, worknudge.co.uk | Friendly reminders/follow-ups | Too soft for full assistant |
| WorkChief | workchief.ai, workchief.co.uk | Chief-of-staff feeling | May feel senior/managerial |
| DeskChief | deskchief.ai, deskchief.co.uk | Personal chief of staff | More US startup flavor |
| WorkRadar | workradar.ai, workradar.co.uk | Spots risks and missed emails | Less PA-like |
| BrieflyPA | brieflypa.ai, brieflypa.co.uk | Briefing plus PA | Slightly awkward spoken aloud |

### Names to avoid or treat carefully

- WorkBuddy, WorkBud, PersonalAssistant: already taken per user research and more generic.
- Copilot variants: crowded by Microsoft and likely weaker for defensibility.
- Secretary: old-fashioned and may carry the wrong tone.
- Executive Assistant: suggests senior executives only, while the target is anyone with one job.
- "Jarvis" style names: legally and culturally noisy.

## Recommended next product decision

Use `WorkPA` unless there is a trademark conflict. It is the clearest bridge between the user pain and the product promise. Build the initial product around three pillars:

1. Inbox watch: "what needs attention?"
2. Meeting ready: "what do I need to know?"
3. Deadline risk: "am I on track?"

That combination is more powerful than any single competitor category because it maps to the real administrative loop of a knowledge worker's day.

## Source links

- Duly: https://getduly.ai/
- Jace AI: https://jace.ai/pricing
- MyHandler: https://myhandler.ai/
- Saner.AI: https://saner.ai/pricing/
- Lindy: https://www.lindy.ai/pricing
- Fyxer AI: https://www.fyxer.com/pricing
- Reclaim.ai: https://reclaim.ai/pricing
- Motion: https://www.usemotion.com/pricing
- Akiflow: https://akiflow.com/pricing
- Sunsama: https://sunsama.com/pricing
- SkedPal: https://www.skedpal.com/pricing/
- FlowSavvy: https://flowsavvy.app/pricing
- Todoist: https://www.todoist.com/pricing
- Todoist pricing update: https://www.todoist.com/help/articles/todoist-pricing-and-plans-update-2025-everything-you-need-to-know-Tn6Pg1JKI
- Superhuman: https://superhuman.com/pricing
- Shortwave: https://www.shortwave.com/pricing/
- SaneBox: https://www.sanebox.com/pricing/
- Mailbutler: https://www.mailbutler.io/pricing/
- Fireflies.ai: https://fireflies.ai/pricing
- Otter.ai: https://otter.ai/pricing
- Microsoft 365 Copilot Business: https://www.microsoft.com/en-us/microsoft-365-copilot/business
- Google Workspace pricing: https://workspace.google.com/pricing.html
- Clockwise shutdown notice: https://www.getclockwise.com/
