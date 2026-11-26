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
  deleted INTEGER NOT NULL DEFAULT 0,
  checklist TEXT NOT NULL DEFAULT '[]',
  remind_at INTEGER NOT NULL DEFAULT 0,
  images TEXT NOT NULL DEFAULT '[]',
  rev INTEGER NOT NULL DEFAULT 0            -- server gán, mốc đồng bộ
);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_rev ON notes(rev);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
