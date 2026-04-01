CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  meeting_url text,                     -- Extracted from hangoutLink / description
  attendees jsonb DEFAULT '[]'::jsonb,  -- [{ email, name, responseStatus }]
  crm_customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed',  -- confirmed, tentative, cancelled
  raw_data jsonb,                        -- Full Google event for debugging
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(integration_id, google_event_id)
);

-- Sync token stored per integration in integrations.metadata.calendar_sync_token

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar events"
  ON calendar_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own calendar events"
  ON calendar_events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for common queries
CREATE INDEX idx_calendar_events_user_start ON calendar_events(user_id, start_time);
CREATE INDEX idx_calendar_events_customer ON calendar_events(crm_customer_id);
CREATE INDEX idx_calendar_events_integration ON calendar_events(integration_id, google_event_id);
