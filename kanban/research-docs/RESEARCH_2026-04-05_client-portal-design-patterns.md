# Research: Client Portal Design Patterns for FractionalBuddy

**Date:** 2026-04-05
**Scope:** How leading SaaS tools handle client-facing portals, permissions, authentication, and UX -- distilled into actionable recommendations for FractionalBuddy's client portal.

---

## 1. Time Tracking Tools: Client-Facing Reports

### Harvest

- **Client visibility:** Clients receive detailed reports showing how hours are allocated across project phases. Invoices are generated from tracked time in 2 clicks and sent with a payment link.
- **Permission model:** Role-based (Administrator / Manager / Member). Managers only see billable amounts if explicitly granted "view billable rates" permission. Members see only their own time.
- **Report sharing:** Export to CSV, PDF, or Google Sheets. Saved/shared reports can auto-recur on a schedule. Invoice links are shareable via email or Slack.
- **Key insight:** Harvest does NOT have a full client portal -- clients receive reports/invoices as exported artifacts or links. No login required for clients.

### Clockify

- **Client portal:** Has a dedicated client portal feature. Reports are shareable via **public links** (no auth required) or PDF export.
- **Permission model:** Workspace-level roles with project-level overrides.
- **Key insight:** Public link sharing is the differentiator -- anyone with the link can view the report, no account needed.

### Toggl Track

- **Client visibility:** Custom analytics dashboards with tables, pivot tables, charts. Reports exported as PDF only -- no public link sharing.
- **Key insight:** Most limited client-facing capability of the three. No external sharing beyond file exports.

### Pattern Summary

| Tool     | Client Login? | Sharing Method                | Real-time?      |
| -------- | ------------- | ----------------------------- | --------------- |
| Harvest  | No            | PDF/CSV export, invoice links | No (snapshot)   |
| Clockify | No            | Public links, PDF             | Yes (live link) |
| Toggl    | No            | PDF export only               | No (snapshot)   |

**Takeaway for FractionalBuddy:** None of these tools give clients a full authenticated portal. They all treat client visibility as "push" (send a report) rather than "pull" (client logs in and browses). FractionalBuddy's authenticated portal is a significant differentiator.

---

## 2. Project Management Tools: Client/Guest Access

### ClickUp

- **Two-tier client access:**
  1. **Guest Access** -- Client logs into ClickUp with controlled permissions (full edit, edit-assigned-only, comment-only, view-only). Guests see only what they're explicitly invited to.
  2. **Public Views** -- Shareable links, no login required. Every view type except dashboards can be shared. More control over hidden fields (can hide comments, status). View-only, no interaction.
- **Recommended approach:** Public Views for most clients; Guest Access reserved for long-term relationships needing frequent interaction.
- **Granularity:** Permissions cascade from Spaces > Folders > Lists > Tasks. Guests are scoped to specific items.

### Monday.com

- **"Broadcast" views:** Shareable/embeddable views that clients can subscribe to for updates. Shows project status without exposing internal details/comments.
- **Board-level privacy:** Private boards protect sensitive data. Role-based permissions control who sees financials vs project status.

### Asana

- **Guest access:** External collaborators invited with limited permissions to specific projects.
- **Flexibility:** Permission system adjusts as projects and org structures evolve.

### Pattern Summary

| Tool    | Auth Required?             | Granularity                  | Client Interaction     |
| ------- | -------------------------- | ---------------------------- | ---------------------- |
| ClickUp | Optional (guest vs public) | Space > Folder > List > Task | Comment, view, or edit |
| Monday  | No (broadcast views)       | Board-level                  | Subscribe only         |
| Asana   | Yes (guest invite)         | Project-level                | Limited collaboration  |

**Takeaway for FractionalBuddy:** ClickUp's two-tier model (authenticated guest + unauthenticated public view) is the most relevant pattern. For FractionalBuddy, the equivalent would be:

- **Portal** (authenticated) = ClickUp Guest Access -- client logs in, sees their modules
- **Shared links** (unauthenticated) = ClickUp Public Views -- consultant shares a specific report/deliverable via link

---

## 3. Fractional Executive Tools: Current Landscape

**Finding: There is no dedicated "fractional executive OS" on the market.** The search returned:

- Generic fractional exec marketplaces (Fractional Executive Connection, Venturous) -- matchmaking platforms, not operating tools
- Positioning/branding services (ECP) -- help fractionals market themselves
- Conference content (Fractional Executive Summit)
- General consulting tools repurposed for fractional work

Fractional executives currently cobble together:

- Time tracking (Toggl/Harvest/Clockify)
- Project management (ClickUp/Asana/Monday)
- CRM (HubSpot/Pipedrive)
- Invoicing (FreshBooks/QuickBooks)
- Notes (Notion/Obsidian)
- Communication (Slack/Email)

**Takeaway for FractionalBuddy:** This is a genuine greenfield opportunity. No competitor offers an integrated client portal for fractional executives. The closest analogue is agency client portals (ManyRequests, Dubsado) but these are designed for productised services, not embedded executive roles.

---

## 4. Client Portal UX Best Practices

### What Clients Want to See

Based on industry research across legal, accounting, creative, and consulting portals:

| Priority | Data Type               | Why Clients Want It                 |
| -------- | ----------------------- | ----------------------------------- |
| High     | Time/hours summary      | "Am I getting value for money?"     |
| High     | Deliverables & status   | "What's been done? What's next?"    |
| High     | Meeting notes/summaries | "What did we discuss?"              |
| High     | Invoices & payments     | "What do I owe?"                    |
| Medium   | Task progress           | "Is the work on track?"             |
| Medium   | Key decisions log       | "What was decided and why?"         |
| Low      | Research/analysis       | Only if directly relevant to client |
| Low      | Internal notes          | Clients don't expect to see these   |

### What Consultants Want to Hide

| Data                        | Reason to Hide               |
| --------------------------- | ---------------------------- |
| Internal notes / thinking   | Work-in-progress, may change |
| Detailed hourly breakdown   | Invites micromanagement      |
| Other client data           | Confidentiality              |
| CRM pipeline / deal data    | Commercial sensitivity       |
| Billing rates for sub-tasks | Exposes internal economics   |
| Draft deliverables          | Not ready for client eyes    |

### Dashboard Layout Patterns

1. **Three-tab minimum:** Messages/Updates, Documents/Deliverables, Billing
2. **Personalised summary first:** Most relevant client data at the top
3. **Status indicators:** Pending approvals, upcoming milestones
4. **Timeline views:** For sequential project phases
5. **Action-oriented sections:** "Review this", "Approve that", "Pay invoice"
6. **Progressive disclosure:** Core tools prominent, advanced features in sub-menus

### UX Principles

- **Simplicity over completeness** -- "Extra features crowd the screen and make navigation harder"
- **Mobile-first** -- Clients check on their phone
- **Sub-3-second load time** -- Users abandon slow dashboards
- **In-context guidance** -- Short prompts inside the portal, not lengthy instructions
- **Branded experience** -- Custom colours/logo builds trust

---

## 5. Permission Model Design

### Three Authorization Patterns

| Pattern                                   | How It Works                                        | When to Use                                |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| **ACL** (Access Control List)             | Direct user-to-permission mapping                   | MVP, simple systems                        |
| **RBAC** (Role-Based Access Control)      | Users get roles, roles have permissions             | Most SaaS apps, recommended starting point |
| **ABAC** (Attribute-Based Access Control) | Contextual rules (time, location, data sensitivity) | Enterprise, complex multi-tenant           |

### Recommended: RBAC + Module-Level Toggles

For FractionalBuddy, the sweet spot is **RBAC with per-engagement module toggles**:

```
Consultant (owner)
  └── Engagement (client relationship)
       ├── Module: Timesheet    → [visible / hidden] to client
       ├── Module: Tasks        → [visible / hidden]
       ├── Module: Meetings     → [visible / hidden]
       ├── Module: Deliverables → [visible / hidden]
       ├── Module: Invoicing    → [visible / hidden]
       ├── Module: Research     → [visible / hidden]
       ├── Module: Notes        → [visible / hidden]
       └── Module: CRM          → [always hidden from client]
```

### Permission Implementation Best Practices

1. **Check permissions on operations, not roles** -- `user.can('view_timesheet', engagement)` not `user.role === 'client'`
2. **Additive only** -- Permissions grant access, never deny. No "deny" rules.
3. **Resource-scoped** -- Every check includes the resource: `user.can('view', deliverable)`
4. **Custom roles stored in DB** -- Different engagements can have different visibility configs
5. **Three granularity levels:**
   - **Module-level:** Toggle entire sections on/off per engagement (primary)
   - **Item-level:** Mark individual items as client-visible or internal-only (secondary)
   - **Field-level:** Hide specific fields like hourly rate within a visible module (tertiary, implement later)

---

## 6. URL Structure

### Recommendation: Path-Based

| Approach    | Example                                        | Verdict                                         |
| ----------- | ---------------------------------------------- | ----------------------------------------------- |
| Subdomain   | `clientname.fractionalbuddy.com`               | Complex DNS, poor localhost dev                 |
| Path        | `app.fractionalbuddy.com/portal/engagement-id` | Recommended -- simple routing, works everywhere |
| Token/link  | `app.fractionalbuddy.com/share/abc123`         | Good for unauthenticated report sharing         |
| Query param | `app.fractionalbuddy.com?client=xyz`           | Feels unofficial, fragile                       |

**Recommended for FractionalBuddy:**

- **Authenticated portal:** `/portal/:engagementId/[module]` -- client logs in and sees their engagement
- **Shared links (future):** `/share/:token` -- unauthenticated, time-limited, specific resource

This aligns with the existing `(portal)` route group in the codebase.

---

## 7. Authentication for Client Users

### Recommendation: Magic Links + Optional SSO

| Method          | UX                               | Security                      | Best For                   |
| --------------- | -------------------------------- | ----------------------------- | -------------------------- |
| Password        | Familiar but friction            | Weakest (81% of breaches)     | Avoid for client portal    |
| Magic Link      | One-click, no password           | Strong (single-use, expiring) | Primary method for clients |
| OTP (SMS/email) | Quick but requires typing        | Moderate                      | Backup/recovery            |
| SSO (SAML/OIDC) | Seamless for enterprise          | Strongest                     | Enterprise clients         |
| Passkeys        | Future-proof, phishing-resistant | Strongest                     | Progressive enhancement    |

**Why magic links for FractionalBuddy clients:**

- Clients log in infrequently (weekly or less) -- perfect for magic links
- No password to forget/manage -- reduces support burden
- Invite-based: consultant adds client email to engagement, client receives magic link
- Medium saw 70% reduction in support tickets after adopting magic links

**Implementation notes:**

- Token expiration: 15 minutes
- Add confirmation step to prevent email scanner (Outlook Safelinks) from invalidating links
- Pair with invite-only access (no public signup for client portal)
- Store device fingerprint for "remember this device" (reduce re-auth friction)

### Auth Flow

```
1. Consultant adds client email to engagement
2. System sends invite email with magic link
3. Client clicks link → verified → session created
4. Subsequent visits: magic link from login page (email only, no password)
5. Enterprise clients: SSO option on login page (future)
```

Since FractionalBuddy already uses Supabase, magic links are natively supported via `supabase.auth.signInWithOtp({ email })`.

---

## 8. Specific Recommendations for FractionalBuddy

### Phase 1: MVP Client Portal

**Modules to expose (defaults):**
| Module | Default Visibility | Rationale |
|--------|--------------------|-----------|
| Deliverables | Visible | Core value -- what was produced |
| Meetings | Visible (summaries only) | Shared context, builds trust |
| Timesheet | Visible (summary view) | Hours + categories, not line-by-line |
| Tasks | Visible (milestones only) | Progress tracking without micromanagement |
| Invoicing | Visible | Payment and billing history |
| Notes | Hidden | Internal thinking |
| Research | Hidden | Internal analysis |
| CRM | Always hidden | Commercial data, never client-facing |
| Contacts | Always hidden | Other relationships, confidential |

**Per-engagement toggle:** Consultant can override defaults for each client engagement.

### Phase 2: Granular Controls

- **Item-level visibility:** Mark individual notes/research items as "share with client"
- **Timesheet detail level:** Toggle between "summary only" (hours per week/category) and "detailed" (line items)
- **Meeting content:** Toggle between "summary + action items" and "full transcript"

### Phase 3: Advanced

- **Shared links:** Unauthenticated, expiring links for specific deliverables
- **Client comments/feedback:** Clients can comment on deliverables and meeting summaries
- **SSO support:** For enterprise clients
- **White-labelling:** Custom domain/branding per consultant

### Client Portal Dashboard Layout

```
+--------------------------------------------------+
| [Logo] Client Portal    [Client Name]  [Logout]  |
+--------------------------------------------------+
| Sidebar          | Main Content                   |
|                  |                                |
| Dashboard        | Welcome, [Client Name]         |
| Deliverables     |                                |
| Meetings         | +------ Summary Cards -------+ |
| Timesheet        | | Hours This Month: 24h      | |
| Tasks            | | Open Tasks: 5              | |
| Invoicing        | | Next Meeting: Apr 8        | |
|                  | | Outstanding: £2,400        | |
|                  | +----------------------------+ |
|                  |                                |
|                  | Recent Activity               |
|                  | - Deliverable uploaded: ...    |
|                  | - Meeting summary: ...         |
|                  | - Invoice sent: ...            |
+--------------------------------------------------+
```

Sidebar shows only modules the consultant has enabled for this engagement.

### Data Model Addition

```sql
-- Per-engagement module visibility
CREATE TABLE engagement_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES engagements(id),
  module TEXT NOT NULL,  -- 'timesheet', 'tasks', 'meetings', etc.
  visible BOOLEAN DEFAULT false,
  detail_level TEXT DEFAULT 'summary',  -- 'summary' | 'detailed' | 'full'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(engagement_id, module)
);

-- Client users linked to engagements
CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  engagement_id UUID REFERENCES engagements(id),
  auth_user_id UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  UNIQUE(email, engagement_id)
);
```

---

## Sources

- [ClickUp Guest Access vs Public Views](https://processdriven.co/clickup/advanced-clickup/inviting-clients-into-your-clickup-guest-access-vs-public-views-in-clickup/)
- [ClickUp Guest-Type User Roles](https://help.clickup.com/hc/en-us/articles/6310022323991-Guest-type-user-roles)
- [ClickUp Guest vs Member Permissions](https://stackset.com/blog/guest-vs-members-in-clickup)
- [Client Portal Examples & Ideas (Noloco)](https://noloco.io/blog/client-portal-examples)
- [Client Portal Best Practices (Assembly)](https://assembly.com/blog/client-portal-best-practices)
- [3 Most Common Authorization Designs for SaaS (Cerbos)](https://www.cerbos.dev/blog/3-most-common-authorization-designs-for-saas-products)
- [How to Structure Permissions in a SaaS App (Heap/Contentsquare)](https://contentsquare.com/blog/structure-permissions-saas-app/)
- [Customer-Specific URLs in SaaS (PropelAuth)](https://www.propelauth.com/post/customer-specific-urls-in-saas-applications)
- [Customer Portal Authentication: SSO, Magic Links, Invite-Only (Supportbench)](https://www.supportbench.com/customer-portal-authentication-sso-magic-links-invite-only-access/)
- [Client Login Security: Passwords, OTP, Magic Links, SSO (Moxo)](https://www.moxo.com/blog/client-login-passwords-otp-magic-links-sso)
- [Harvest Time Reports](https://support.getharvest.com/hc/en-us/articles/360048181692-Time-report)
- [Harvest Reports & Analysis](https://www.getharvest.com/features/reports-and-analysis)
- [Clockify vs Harvest (Toggl)](https://toggl.com/blog/clockify-vs-harvest)
- [Magic Links for Client Portals (Debits)](https://www.debits.com/magic-links-accounting-passwordless-client-access/)
- [Fractional Consulting Guide (Consulting Success)](https://www.consultingsuccess.com/what-is-fractional-consulting-a-comprehensive-guide-for-consultants)
