# Idea: Daily Automated Backup + Daily Draft Invoice Email

**Date captured:** 2026-04-24
**Requested by:** David

## Raw idea

> "I would like to backup everything in FractionalBuddy once a day. The timesheets are especially important. Meetings etc should also be backed up though. It would be great if it also sent a draft invoice to me everyday. My email is david@agilecommercegroup.com."

## Why this matters

- Time entries are the source of billable revenue — losing them = losing income. A daily off-site backup is insurance.
- Meeting transcripts are expensive to regenerate (Claude API cost + human review) — worth protecting.
- A daily draft-invoice snapshot ("where am I at this month?") gives David visibility without having to open the app.

## Rough scope

- Back up all operational data to an off-site location (not the same Supabase project).
- Send a daily email with a draft invoice summary to `david@agilecommercegroup.com`.
- Both should be automatic, not manual.

## Unknowns at idea stage (answered during planning)

- Where do backups go? → **Email attachment** (small dataset, off-site via Gmail/Drive, no new creds needed).
- How do we send email? → **Resend** (no existing email infra; simplest to add).
- What does "draft invoice" mean? → **Month-to-date snapshot** per active engagement, HTML email body (not a DB row).
- Schedule? → **02:00 UTC backup**, **07:00 UTC invoice** (separate crons for failure isolation).
