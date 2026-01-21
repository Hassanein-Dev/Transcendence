export const userSchema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  github_id TEXT UNIQUE,
  picture TEXT,
  fullname TEXT,
  bio TEXT,
  birthday TEXT,
  status TEXT,
  lives_in TEXT,
  from_place TEXT,
  gender TEXT,
  education TEXT,
  phone TEXT,
  relationship_status TEXT,
  cover_photo TEXT,
  created_at TEXT NOT NULL,
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_secret TEXT,
  deleted INTEGER DEFAULT 0
)`;

export const userFriendSchema = `
CREATE TABLE IF NOT EXISTS user_friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(user_id, friend_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(friend_id) REFERENCES users(id)
)`;

export const userOnlineStatusSchema = `
CREATE TABLE IF NOT EXISTS user_online_status (
  user_id INTEGER PRIMARY KEY,
  is_online BOOLEAN DEFAULT 0,
  last_seen TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`;

export const user2FASchema = `
CREATE TABLE IF NOT EXISTS user_2fa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 0,
  backup_codes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`;

export const user2FATempSchema = `
CREATE TABLE IF NOT EXISTS user_2fa_temp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`;

export const passwordResetSchema = `
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`;