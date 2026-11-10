-- Apply only to buildit-production, after schema.sql. Safe to rerun.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS patreon_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patreon_oauth_expiry ON patreon_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS patreon_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  patreon_user_id TEXT NOT NULL UNIQUE,
  access_encrypted TEXT NOT NULL,
  refresh_encrypted TEXT,
  expires_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  status TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  policy_key TEXT NOT NULL,
  refresh_lock_until INTEGER NOT NULL DEFAULT 0
);
