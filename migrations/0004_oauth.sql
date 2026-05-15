CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  secret TEXT,
  redirect_uris TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_uri TEXT NOT NULL DEFAULT '',
  scopes TEXT NOT NULL DEFAULT 'crm',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'crm',
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes (expires_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('access','refresh')),
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'crm',
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_kind ON oauth_tokens (kind, expires_at);
