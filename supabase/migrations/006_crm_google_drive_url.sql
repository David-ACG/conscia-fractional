-- Add Google Drive URL to CRM customers
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS google_drive_url text;
