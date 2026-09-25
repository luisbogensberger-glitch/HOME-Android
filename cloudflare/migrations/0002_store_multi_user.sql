-- HOME Store v1: isolated multi-user data model.
-- Keeps the existing private single-user tables untouched.

CREATE TABLE IF NOT EXISTS store_tasks (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_store_tasks_user_updated ON store_tasks(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS store_cards (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_store_cards_user_updated ON store_cards(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS store_attempts (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_store_attempts_user_created ON store_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_activity (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_store_activity_user_created ON store_activity(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
);
