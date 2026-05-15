# WorkPA Coach Feature Research

Date checked: 15 May 2026

Purpose: context for extending WorkPA from an AI PA into a low-risk work coach that helps users perform better, manage stakeholders, track promotion evidence, and prepare for career progression.

## Summary recommendation

Add "work coach" functionality, but keep the product grounded in real work evidence. The app should not become a generic motivational chatbot. Its advantage is that it already sees the user's calendar, meetings, tasks, emails, commitments, and achievements. That lets it coach from evidence rather than vague self-reporting.

The best product framing:

> WorkPA is your AI PA and work coach: it helps you stay on top of today while building the evidence and relationships that move your career forward.

The strongest additions are:

- Team structure and stakeholder map.
- Internal/external stakeholder analysis.
- Achievement tracker that turns everyday work into promotion evidence.
- Promotion plan tied to role expectations and measurable impact.
- Manager 1:1 prep, performance review prep, and stakeholder follow-up prompts.
- Weekly coaching review: wins, misses, blockers, relationships, visibility, and next-week plan.

## What career and life coaches actually do

Sources reviewed include the International Coaching Federation, Career Development Institute, International Association of Career Coaches, BetterUp, GROW coaching framework material, HBR promotion articles, and current AI/career-coaching products.

### Core coaching behaviours to model

Professional coaching is less about giving commands and more about creating structure for reflection, action, and accountability. The ICF describes coaching around ethics, trust, active listening, reflection, action, growth, and accountability. Its current competency guidance explicitly includes helping clients translate insight into action, reflect deeply, set clear goals, and commit to specific actions.

For WorkPA, this maps to product behaviours:

- Ask good reflective questions.
- Help the user define goals.
- Turn goals into action plans.
- Track commitments.
- Review progress.
- Help the user notice patterns.
- Celebrate evidence-based progress.
- Keep confidentiality and boundaries clear.

### Career-specific coaching

Career coaches help people:

- Clarify what they want from their career.
- Set and achieve professional goals.
- Build skills for the next role.
- Prepare for promotion, raise, and negotiation conversations.
- Develop leadership, communication, and personal brand.
- Network more effectively.
- Navigate feeling stuck, undervalued, burned out, or unclear.
- Package achievements for reviews, interviews, and internal opportunities.

The International Association of Career Coaches states the goal of career coaching is to help professionals get, keep, and advance in work. The Career Development Institute's framework adds useful learning areas: grow throughout life, explore possibilities, manage career, create opportunities, balance life and work, and see the big picture.

### Useful coaching frameworks

Use these as product patterns, not visible theory-heavy UI.

| Framework | What it means | WorkPA use |
| --- | --- | --- |
| GROW | Goal, Reality, Options, Will/Way Forward | Short coaching flows for promotion goals, difficult meetings, stakeholder issues, or skill gaps |
| STAR | Situation, Task, Action, Result | Achievement tracker, performance review evidence, promotion packets, interview examples |
| 360-style feedback | Feedback from manager, peers, stakeholders | Optional structured feedback import or self-rated relationship/skill map |
| Power/interest stakeholder map | Classify people by influence and interest | Relationship strategy, communication cadence, sponsor/blocker detection |
| Weekly reflection | What happened, what mattered, what to change | Weekly work coach review |

## Product modules

### 1. Career Profile

This is the user's career context layer.

Fields:

- Current role, level, department, manager.
- Target role or next promotion level.
- Promotion cycle dates.
- Company values, competency framework, or job ladder if available.
- Manager expectations.
- Known strengths and development areas.
- Work preferences and constraints.
- Personal career goals.
- Skills the user wants to build.

AI use:

- Convert vague goals into measurable development goals.
- Ask for missing context.
- Suggest likely evidence needed for promotion.
- Identify mismatches between current work and target role.

### 2. Team Structure

WorkPA should maintain an org/work graph, not just a contacts list.

Entities:

- User.
- Manager.
- Skip-level manager.
- Direct reports, if any.
- Peers.
- Cross-functional partners.
- Senior leaders.
- External clients, vendors, agencies, partners.

Relationship fields:

- Role and team.
- Internal or external.
- Projects connected to this person.
- Decision rights.
- Relationship strength.
- Communication style.
- Last contact.
- Next useful touchpoint.
- Open commitments.
- Risks or sensitivities.

This powers meeting briefs, stakeholder nudges, and promotion strategy.

### 3. Stakeholder Analysis

Use a simple power/interest or influence/impact matrix.

Stakeholder dimensions:

- Power: ability to approve, block, resource, promote, or influence outcomes.
- Interest: how much they care about the user's work or project.
- Support level: advocate, neutral, sceptic, blocker, unknown.
- Relationship quality: strong, developing, weak, strained, unknown.
- Communication need: inform, consult, involve, manage closely.
- Preferred channel and cadence.
- Evidence that matters to them.

WorkPA coaching prompts:

- "You have not updated Sarah on this project for 18 days. She is high power/high interest."
- "This meeting includes two stakeholders connected to your promotion evidence. Bring the metric from last week's launch."
- "Your stakeholder map has no senior sponsor for the target promotion. Identify one possible sponsor this month."

Safety rule: WorkPA should suggest stakeholder actions, not manipulate or message people automatically.

### 4. Achievement Tracker

This should be a core feature. It creates the promotion evidence that most people fail to collect.

Capture sources:

- Completed tasks.
- Meeting transcripts and action items.
- Emails where someone thanks, praises, approves, or confirms impact.
- Metrics from projects.
- Manager 1:1 notes.
- User voice notes.
- Weekly reflection.

Achievement structure:

- Title.
- Date.
- Project/customer/team.
- Situation or problem.
- User's responsibility.
- Action taken.
- Result.
- Metric or evidence.
- Skills demonstrated.
- Stakeholders affected.
- Business value category.
- Promotion relevance.
- Confidence/source links.

Use STAR as the default writing pattern, because it is widely used for CVs, interviews, and applications. The UK's National Careers Service describes STAR as Situation, Task, Action, Result and recommends it for CVs, cover letters, applications, and interviews.

### 5. Achievement Suggestions

The app should not only record achievements. It should suggest useful promotion-building achievements.

Suggestion categories:

- Deliver a measurable result: revenue, cost, time saved, quality, risk reduction, customer impact.
- Lead something visible: meeting, project, initiative, workshop, rollout.
- Improve a process: automate, document, reduce cycle time, reduce errors.
- Build cross-functional influence: align two teams, resolve conflict, unblock dependency.
- Mentor/support others: onboarding, coaching, knowledge sharing.
- Show strategic thinking: connect task to company priority, propose roadmap, identify risk early.
- Demonstrate ownership: take a messy problem to closure.
- Improve communication: write a decision memo, executive update, stakeholder brief.
- Customer/client value: solve a client problem, retain account, improve satisfaction.
- Learning/growth: gain skill, apply it, show business impact.

Example suggestions:

- "You have several execution wins but few visibility wins. Suggestion: present the project outcome in the next team meeting."
- "This task has promotion evidence potential if you capture the before/after metric."
- "You are doing a lot of coordination work. Convert one repeat process into a documented playbook."
- "Your target role requires stakeholder leadership. Pick one high-interest stakeholder and run a proactive update this week."

### 6. Promotion Plan

Promotion coaching should be explicit and structured.

Workflow:

1. Define target role or level.
2. Import or write promotion criteria.
3. Map current evidence to criteria.
4. Identify missing evidence.
5. Create quarterly promotion milestones.
6. Turn milestones into weekly actions.
7. Prepare manager conversations.
8. Generate performance review packet.

Promotion dashboard:

- Target role.
- Promotion readiness score.
- Evidence by competency.
- Missing evidence.
- Sponsor/support map.
- Upcoming chances to create evidence.
- Manager conversation history.
- Next best action.

Important: never promise promotion. Phrase as "strengthen your case" and "build evidence".

### 7. Manager 1:1 Prep

Before a 1:1, WorkPA should prepare:

- What changed since last 1:1.
- Completed wins.
- Blockers needing manager help.
- Decisions needed.
- Feedback to ask for.
- Promotion evidence to mention.
- Questions tied to target role.

After the 1:1:

- Extract commitments.
- Update promotion plan.
- Update stakeholder notes.
- Add achievement evidence if relevant.

### 8. Weekly Work Coach Review

A useful weekly review should ask:

- What did you complete?
- What mattered most?
- What slipped?
- What did you learn?
- Which stakeholder relationships improved or worsened?
- What achievement evidence was created?
- What promotion criteria did this support?
- What is the highest-leverage action next week?

The output should be concise:

- Wins.
- Risks.
- Stakeholder actions.
- Achievement tracker updates.
- Next week's development focus.

### 9. Communication and Leadership Practice

AI coaching can help the user rehearse:

- Asking for promotion criteria.
- Asking for feedback.
- Saying no or renegotiating scope.
- Presenting work to senior stakeholders.
- Handling conflict.
- Giving difficult feedback.
- Explaining impact without sounding boastful.
- Asking for sponsorship.

This can be text or speech-based. The SkillMint product is an example of voice-based career coaching for soft skills and promotion-oriented practice.

## Boundaries and safety

WorkPA should position itself as a work coach, not therapist, HR department, legal adviser, or guaranteed promotion system.

Rules:

- Do not diagnose mental health, burnout, trauma, ADHD, or workplace discrimination claims.
- Do not advise deception, manipulation, or office politics as coercion.
- Do not send career-sensitive messages without explicit approval.
- Do not reveal private reflections to employer/admins.
- Do not make promises about promotion outcomes.
- Keep coaching data private by default.
- Maintain source links and audit trail for inferred achievements or stakeholder labels.

The ICF Code of Ethics is useful as inspiration for product trust: clear role boundaries, confidentiality, privacy, and responsible use of technology.

## MVP scope

Start with:

1. Career Profile.
2. Achievement Tracker.
3. Manager 1:1 Prep.
4. Weekly Work Coach Review.
5. Stakeholder Map v1.
6. Promotion Evidence Packet.

Do later:

- Full 360 feedback.
- Public personal branding/LinkedIn content.
- Job-search tooling.
- External recruiter/interview workflows.
- Team/manager enterprise dashboards.

## Data model sketch

Core tables/entities:

- `career_profiles`
- `career_goals`
- `promotion_targets`
- `competencies`
- `stakeholders`
- `stakeholder_relationships`
- `stakeholder_touchpoints`
- `achievements`
- `achievement_sources`
- `coaching_sessions`
- `weekly_reviews`
- `manager_1_1s`
- `development_actions`

Each AI-generated field should include:

- source event/document references
- confidence
- last reviewed by user
- user override value

## Sources

- ICF Core Competencies: https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/
- ICF Code of Ethics: https://coachingfederation.org/credentialing/coaching-ethics/icf-code-of-ethics/
- Career Development Institute framework: https://www.thecdi.net/resources/cdi-framework
- International Association of Career Coaches: https://www.iacareercoaches.org/post/what-does-a-career-coach-do
- BetterUp individual coaching overview: https://support.betterup.com/hc/en-us/articles/4404323836699-BetterUp-Direct-What-is-BetterUp-Direct-
- BetterUp member experience overview: https://support.betterup.com/hc/en-us/articles/26194068445595-Member-Experience-Overview
- GROW model overview: https://www.performanceconsultants.com/resources/the-grow-model/
- National Careers Service STAR method: https://nationalcareers.service.gov.uk/careers-advice/interview-advice/the-star-method
- HBR, How to Get Your First Promotion: https://hbr.org/2022/10/how-to-get-your-first-promotion
- Center for Creative Leadership 360 assessment overview: https://www.ccl.org/articles/leading-effectively-articles/360-assessment-results-meaning/
- SkillMint AI career coach: https://skillmint.app/
- Tenure Career Win Tracker: https://apps.apple.com/us/app/tenure-career-win-tracker/id6757939990
- CareerCache achievement tracker: https://careercache.io/
- Career Capital: https://career-capital.com/
