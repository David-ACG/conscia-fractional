# Supabase Setup — FractionalBuddy.com

## 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Choose a region close to you (EU West for UK)
3. Save the database password securely
4. Note the project URL and anon key from Settings > API

## 2. Environment Variables

Copy `.env.local.example` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, never expose to browser
```

## 3. Run Migrations

### Option A: Supabase CLI (recommended)

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### Option B: SQL Editor

1. Go to Supabase Dashboard > SQL Editor
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_seed_conscia.sql`

## 4. Enable JWT Claims Hook

1. Go to **Authentication > Hooks** in the Supabase Dashboard
2. Find **Customize Access Token (JWT) Claims**
3. Enable it and select the `custom_access_token_hook` function
4. Save

This hook reads from the `user_roles` table and sets `app_role` and `client_id` on every JWT, enabling RLS policies to distinguish consultant vs client access.

## 5. Configure Google OAuth

1. Go to **Authentication > Providers > Google**
2. Enable Google provider
3. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Application type: Web application
   - Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Enter the Client ID and Client Secret in Supabase
5. Save

## 6. Add Consultant User Role

After signing in with Google for the first time, add yourself as consultant:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('your-auth-user-uuid', 'consultant');
```

Find your user UUID in **Authentication > Users** in the dashboard.

## 7. Add Client Portal Users

For client access (magic link auth):

```sql
INSERT INTO public.user_roles (user_id, role, client_id)
VALUES ('client-auth-user-uuid', 'client', (SELECT id FROM clients WHERE slug = 'conscia'));
```

## Schema Overview

| Table                     | Purpose              | Client visible            |
| ------------------------- | -------------------- | ------------------------- |
| clients                   | Fractional companies | Own record only           |
| engagements               | Contract terms       | Yes (own)                 |
| contacts                  | People at client     | Where `is_client_visible` |
| crm_customers             | End customers        | Where `is_client_visible` |
| tasks                     | Task tracking        | Where `is_client_visible` |
| meetings                  | Meeting notes        | Where `is_client_visible` |
| time_entries              | Time tracking        | Where `is_client_visible` |
| active_timer              | Running timer        | Consultant only           |
| notes                     | Working notes        | Where `is_client_visible` |
| research                  | Research docs        | Where `is_client_visible` |
| assets                    | Templates/diagrams   | Where `is_client_visible` |
| deliverables              | Client deliverables  | Where `is_client_visible` |
| engagement_questionnaires | Onboarding Qs        | Own engagement            |
| scope_creep_log           | Scope tracking       | Own engagement            |
| invoices                  | FreeAgent sync       | Where `is_client_visible` |
| audit_log                 | Access tracking      | Consultant only           |
| user_roles                | Auth roles           | Consultant only           |
