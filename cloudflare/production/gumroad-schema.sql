-- Apply after cloudflare/production/schema.sql to a NEW production D1 database.
-- Gumroad Membership entitlements: a sale can belong to exactly one Discord user.
CREATE TABLE IF NOT EXISTS gumroad_memberships (
  sale_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  encrypted_license TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  ends_at INTEGER,
  checked_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gumroad_memberships_user
  ON gumroad_memberships(user_id,checked_at);

CREATE TABLE IF NOT EXISTS gumroad_redeem_attempts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
