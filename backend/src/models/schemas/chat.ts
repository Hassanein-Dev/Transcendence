export const chatMessageSchema = `
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER,
  room_id TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TEXT NOT NULL,
  read_at TEXT,
  FOREIGN KEY(sender_id) REFERENCES users(id),
  FOREIGN KEY(receiver_id) REFERENCES users(id)
)`;
