# Task: Add Resend-based email service with attachment support

**Date:** 2026-04-24
**Plan Reference:** PLAN_2026-04-24_daily-backup-and-invoice.md

## What to change

FractionalBuddy currently has no code path for sending email. Two upcoming features (daily backup, daily draft invoice) need to send emails — including one with a zip attachment. Add a thin Resend wrapper that both can share, plus Vitest coverage.

## Specific Instructions

1. Install dependency:

   ```
   npm install resend
   ```

2. Update `.env.example` to include (and document) three new env vars:

   - `RESEND_API_KEY=re_xxx` — create at resend.com/api-keys.
   - `RESEND_FROM_EMAIL=onboarding@resend.dev` — Resend's shared sender for v1; swap to a verified domain later.
   - `ALERT_EMAIL=david@agilecommercegroup.com` — recipient for all operational emails.

3. Create `src/lib/services/email-service.ts` exporting:

   ```ts
   export type EmailAttachment = {
     filename: string;
     content: Buffer | string; // Buffer for binary, string for text
     contentType?: string;     // e.g. "application/zip"
   };

   export type SendEmailInput = {
     to: string | string[];
     subject: string;
     html: string;
     text?: string;
     replyTo?: string;
     attachments?: EmailAttachment[];
   };

   export async function sendEmail(input: SendEmailInput): Promise<{ id: string }>;
   ```

   Behaviour:

   - Reads `RESEND_API_KEY` and `RESEND_FROM_EMAIL` from env on each call (no singleton — simpler to test).
   - Throws if `RESEND_API_KEY` is missing (error message: `"RESEND_API_KEY is not set"`).
   - Uses `new Resend(apiKey).emails.send({...})` — maps `from` from `RESEND_FROM_EMAIL`, defaults `replyTo` to `ALERT_EMAIL` if the caller doesn't supply one.
   - Attachment buffers are passed as-is to Resend's `attachments` array (Resend expects `{ filename, content }` where `content` is a base64 string OR Buffer — use Buffer).
   - Returns `{ id }` from Resend's response. If Resend returns an `{ error }` object, throw an Error containing the Resend error message.

4. Create `src/lib/services/__tests__/email-service.test.ts` using Vitest. Mock the `resend` module with `vi.mock("resend", () => ({ Resend: vi.fn() }))`. Cover:

   - Happy path: valid input → Resend's `send` is called with expected payload shape (from, to, subject, html, attachments).
   - Missing API key: throws `"RESEND_API_KEY is not set"`.
   - Resend returns `{ error }`: the service throws an Error wrapping the Resend error message.
   - Attachment passthrough: a `{filename, content: Buffer.from("hi"), contentType: "text/plain"}` round-trips correctly.
   - `replyTo` defaulting: when caller omits `replyTo`, the Resend call uses `ALERT_EMAIL`.

5. Do NOT wire the service into any cron routes or UI in this prompt — that's Prompts 02 and 04.

## Files likely affected

- `package.json`
- `.env.example`
- `src/lib/services/email-service.ts` (new)
- `src/lib/services/__tests__/email-service.test.ts` (new)

## Acceptance criteria

- [ ] `npm install` completes, `resend` appears in `package.json` dependencies.
- [ ] `.env.example` documents all three new vars with clear comments.
- [ ] `npm test -- email-service` passes ≥ 5 assertions covering the cases above.
- [ ] `npx tsc --noEmit` (or the project's typecheck script) passes with no new errors.
- [ ] No calls to `sendEmail()` exist anywhere else in `src/` after this prompt — it's a pure library addition.

## Notes

- Resend's Node SDK is `resend` (not `@resend/node`). Version 4.x at time of writing.
- Keep the wrapper minimal — do NOT add retry logic, queueing, or rate-limit handling in this prompt. If Resend throws, let the caller (the cron route) decide how to respond.
- The daily-backup zip will be up to ~5 MB in practice. Resend attachment limit is 40 MB. No need for size-guard logic yet.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-04-24 14:30

- [ ] Instructions are clear and self-contained — installs `resend`, creates service, creates tests, no cross-prompt coupling beyond documented exports
- [ ] File paths are correct for FractionalBuddy — `src/lib/services/email-service.ts` matches existing service layout
- [ ] Acceptance criteria match the plan — pure library addition, no UI or cron wiring yet
- [ ] The prompt doesn't introduce scope creep — explicitly states no retry logic, no queueing
- [ ] Env-var naming is consistent with existing conventions (`*_EMAIL`, `*_API_KEY`)
- [ ] Wrapper is thin enough that Prompts 02 and 04 can compose it without modification

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-24_01-email-service-resend.md`

## Implementation Notes

## Testing Checklist

### Actions for David
