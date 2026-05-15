CREATE TABLE IF NOT EXISTS call_activity (
  id TEXT PRIMARY KEY,
  contact_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  disposition TEXT,
  notes TEXT,
  zoom_engagement_id TEXT,
  raw_event TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_call_activity_contact_id
  ON call_activity (contact_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_activity_phone
  ON call_activity (phone_number, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_activity_zoom_engagement
  ON call_activity (zoom_engagement_id);
