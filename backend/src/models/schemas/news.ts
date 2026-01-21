export const newsSchema = `
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'news', -- 'news' or 'event'
  event_date TEXT, -- Nullable, for scheduled events
  created_at TEXT NOT NULL
)`;
