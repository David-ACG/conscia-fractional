-- Link CRM customers to Google Drive folders
CREATE TABLE crm_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id uuid NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  folder_id text NOT NULL,           -- Google Drive folder ID
  folder_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(crm_customer_id, integration_id, folder_id) -- prevent duplicate links
);

-- Row Level Security
ALTER TABLE crm_drive_folders ENABLE ROW LEVEL SECURITY;

-- Users see folders linked via their own integrations
CREATE POLICY "Users see own integration folders" ON crm_drive_folders
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations WHERE user_id = auth.uid()
    )
  );

-- Cache file metadata locally
CREATE TABLE drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_drive_folder_id uuid NOT NULL REFERENCES crm_drive_folders(id) ON DELETE CASCADE,
  google_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  modified_at timestamptz,
  web_view_link text,
  thumbnail_link text,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(crm_drive_folder_id, google_file_id) -- prevent duplicate file entries per folder
);

-- Row Level Security
ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;

-- Users see files in folders linked via their own integrations
CREATE POLICY "Users see own integration files" ON drive_files
  FOR ALL USING (
    crm_drive_folder_id IN (
      SELECT cdf.id FROM crm_drive_folders cdf
      JOIN integrations i ON i.id = cdf.integration_id
      WHERE i.user_id = auth.uid()
    )
  );
