-- schema.sql — Schéma PostgreSQL complet (étape 2).
-- SQL brut, pas d'ORM. Tables/colonnes en snake_case.
-- Idempotent : IF NOT EXISTS sur chaque CREATE → migrate.js relançable sans crash.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'accepted',  -- 'pending' | 'accepted'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Migration pour bases déjà créées (idempotent).
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'accepted';

CREATE TABLE IF NOT EXISTS searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  keyword VARCHAR(255) NOT NULL,
  price_min INTEGER,
  price_max INTEGER,
  size VARCHAR(20),
  interval_search INTEGER,
  interval_recheck INTEGER,
  max_results INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  search_id INTEGER REFERENCES searches(id) ON DELETE CASCADE,
  title TEXT,
  price INTEGER,
  size VARCHAR(50),
  seller VARCHAR(100),
  url TEXT,
  found_at TIMESTAMP DEFAULT NOW()
);

-- Index utiles (additifs, idempotents).
CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_group ON searches(group_id);
CREATE INDEX IF NOT EXISTS idx_results_search ON results(search_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_members_user_status ON group_members(user_id, status);
