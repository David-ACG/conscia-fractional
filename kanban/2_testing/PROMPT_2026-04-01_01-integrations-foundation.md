# PROMPT 01: Integrations Table + Settings Page + Token Encryption

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application for fractional executives. It uses Supabase (PostgreSQL with RLS) for auth and database. All server actions use `createAdminClient` from `src/lib/supabase/admin.ts` which bypasses RLS using the service role key. UI is Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons.

Key files:

- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (SSR), `admin.ts` (service role)
- Existing migrations: `supabase/migrations/001_initial_schema.sql` through `006_crm_google_drive_url.sql` (numbered sequentially, no date prefix)
- Types: `src/lib/types.ts` — all DB entity interfaces
- Sidebar: `src/components/layout/sidebar.tsx` — uses Lucide icons, has `mainNavItems`, `secondaryNavItemsAfterCrm`, `tertiaryNavItems`, `bottomNavItems` arrays
- Dashboard layout: `src/app/(dashboard)/layout.tsx` — route group `(dashboard)` wraps all dashboard pages
- Env example: `.env.local.example`
- Site URL: `http://localhost:3002`
- Testing: Vitest (`npm test`)

## Task

### 1. Create Supabase migration `supabase/migrations/007_integrations.sql`

```sql
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,  -- 'google', 'slack', 'deepgram', etc.
  account_identifier text,  -- email or workspace name
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint: one integration per provider per account per user
ALTER TABLE integrations ADD CONSTRAINT integrations_user_provider_account_unique
  UNIQUE (user_id, provider, account_identifier);

-- RLS: users can only see/modify their own integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger (reuse pattern from existing tables if one exists, otherwise create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Create token encryption utility at `src/lib/encryption.ts`

- Use Node.js `crypto` module with AES-256-GCM
- Read encryption key from `process.env.ENCRYPTION_KEY` (must be 64-char hex string = 32 bytes)
- `encrypt(plaintext: string)` returns a JSON string containing `{ iv, encrypted, tag }` (all hex-encoded)
- `decrypt(encryptedPayload: string)` parses the JSON and returns the original plaintext
- Throw clear errors if `ENCRYPTION_KEY` is missing or malformed

### 3. Create integration service at `src/lib/services/integration-service.ts`

- Import `createAdminClient` from `@/lib/supabase/admin`
- Import `encrypt`, `decrypt` from `@/lib/encryption`
- All methods accept `userId` as first param (obtained from auth in the calling code)
- Methods:
  - `getIntegrations(userId: string)` — returns all integrations for user, decrypting tokens
  - `getIntegration(userId: string, provider: string)` — returns single integration or null
  - `upsertIntegration(userId: string, data: UpsertIntegrationData)` — creates or updates, encrypts tokens before storing
  - `deleteIntegration(userId: string, integrationId: string)` — soft-delete by setting `is_active = false`
  - `refreshTokenIfNeeded(integration: Integration)` — placeholder that checks `token_expires_at` and returns whether refresh is needed (actual OAuth refresh logic comes later)
- Define `Integration` interface in this file (matching the DB table)
- Define `UpsertIntegrationData` type

### 4. Add `Integration` type to `src/lib/types.ts`

Add an `Integration` interface matching the DB schema at the end of the file.

### 5. Create Settings page at `src/app/(dashboard)/settings/page.tsx`

- Server component that fetches user's integrations via `integration-service.ts`
- Get current user from `createClient()` (from `@/lib/supabase/server`)
- Display a grid of provider cards (Google, Slack, Deepgram)
- Each card shows:
  - Provider icon and name
  - Connected status badge (green "Connected" or grey "Not Connected") using `Badge` from shadcn
  - Account identifier (email/workspace) when connected
  - Connected date when connected
  - "Connect" button (disabled, placeholder for future OAuth flows) for disconnected
  - "Disconnect" button for connected (calls a server action that uses `deleteIntegration`)
- Create server action `disconnectIntegration` in `src/lib/actions/integrations.ts` using `createAdminClient`
- Use existing UI components: `Card`, `Badge`, `Button` from `src/components/ui/`
- Page title: "Settings" with subtitle "Manage your integrations and preferences"

### 6. Add Settings to sidebar navigation

In `src/components/layout/sidebar.tsx`:

- Import `Settings` icon from `lucide-react`
- Add `{ href: "/settings", label: "Settings", icon: Settings }` to the `bottomNavItems` array (after "Shared with Client")

### 7. Add `ENCRYPTION_KEY` to `.env.local.example`

Add:

```
# Encryption (32-byte hex string for AES-256-GCM)
ENCRYPTION_KEY=
```

### 8. Write Vitest tests

Create `src/lib/__tests__/encryption.test.ts`:

- Test encrypt/decrypt roundtrip with various strings (empty, unicode, long)
- Test that encrypted output contains iv, encrypted, tag fields
- Test that decrypt fails gracefully with tampered data
- Test error when ENCRYPTION_KEY is missing

Create `src/lib/services/__tests__/integration-service.test.ts`:

- Mock `createAdminClient` to return a mock Supabase client
- Mock `encrypt`/`decrypt` from `@/lib/encryption`
- Test `getIntegrations` returns decrypted integrations
- Test `upsertIntegration` calls encrypt before storing
- Test `deleteIntegration` sets `is_active = false`
- Test `getIntegration` returns null when not found

## Acceptance Criteria

- [ ] Migration `007_integrations.sql` creates the `integrations` table with RLS policies
- [ ] `src/lib/encryption.ts` encrypts/decrypts tokens correctly using AES-256-GCM
- [ ] `src/lib/services/integration-service.ts` provides CRUD operations with transparent encryption
- [ ] `Integration` type added to `src/lib/types.ts`
- [ ] Settings page at `/settings` renders provider cards with correct status
- [ ] Disconnect button calls server action to deactivate integration
- [ ] Sidebar shows Settings link in bottom nav items
- [ ] `ENCRYPTION_KEY` added to `.env.local.example`
- [ ] All tests pass (`npm test`)

## Test Expectations

Run `npm test` — all new and existing tests must pass. Key test scenarios:

- Encryption roundtrip: encrypt then decrypt returns original string
- Tampered ciphertext: decrypt throws an error
- Integration service: mock Supabase calls verify correct encrypt/decrypt usage

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Migration number 007 follows the existing sequence
- [ ] Settings page uses `(dashboard)` route group correctly
- [ ] Sidebar modification targets the correct array

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_01-integrations-foundation.md`
