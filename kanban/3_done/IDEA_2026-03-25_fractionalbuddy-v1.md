# FractionalBuddy.com — V1

Build a web-based "Fractional Executive OS" for managing part-time/fractional work at Conscia.

## Core Modules

1. Dashboard — glance-and-go overview
2. Calendar — merged Google + MS calendars via API
3. Contacts — people at client company with preferences
4. CRM — customer cards per client
5. Meetings — transcription via Deepgram, AI task extraction via Claude
6. Research — architecture/service research notes
7. Timesheet — timer widget, meeting auto-logging, FreeAgent sync
8. Tasks — kanban per client, auto from meetings, dependency tracking
9. Assets — templates, diagrams, reusable IP
10. Deliverables — work products, publishable to portal
11. Engagement — scope, contract terms, ways of working questionnaire
12. Notes — working notes, decision log
13. Invoicing — FreeAgent integration
14. Shared with Client — magic-link portal with curated view

## Key Integrations

- Supabase Auth + RLS (consultant + client roles)
- Google Calendar API + Microsoft Graph API
- Deepgram Nova-2 (STT)
- Claude Sonnet 4 (action item extraction)
- FreeAgent API (timeslips + invoices)

## Research

See: kanban/research-docs/RESEARCH_2026-03-25_fractionalbuddy-market-and-tech.md
