CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  name text NOT NULL,
  source_type text NOT NULL,        -- 'asset', 'meeting', 'drive_file', 'note', 'upload'
  source_id uuid,                   -- FK to the source record (polymorphic, no constraint)
  chunk_count integer DEFAULT 0,
  embedded_at timestamptz,          -- NULL = pending embedding
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_customer ON documents(crm_customer_id);
CREATE INDEX idx_documents_pending ON documents(user_id) WHERE embedded_at IS NULL;
CREATE INDEX idx_documents_source ON documents(source_type, source_id);

-- RLS: users see own documents only
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);
