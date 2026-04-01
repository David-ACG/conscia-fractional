CREATE TABLE slack_channel_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  crm_customer_id uuid NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(integration_id, channel_id)
);

ALTER TABLE slack_channel_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own channel mappings"
  ON slack_channel_mappings
  FOR ALL
  USING (
    integration_id IN (
      SELECT id FROM integrations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    integration_id IN (
      SELECT id FROM integrations WHERE user_id = auth.uid()
    )
  );
