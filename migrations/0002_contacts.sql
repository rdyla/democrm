CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  account_value INTEGER NOT NULL DEFAULT 0,
  last_contacted TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone);
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts (mobile);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON contacts (last_name, first_name);
