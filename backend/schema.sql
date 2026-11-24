CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'idea',        -- bug | idea | improvement
  priority TEXT NOT NULL DEFAULT 'medium',  -- high | medium | low
  status TEXT NOT NULL DEFAULT 'new',       -- new | doing | done
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
