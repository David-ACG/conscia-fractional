-- Add last_synced_at to crm_drive_folders for tracking sync status
ALTER TABLE crm_drive_folders ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
