import db from "./connection";
import {
  userSchema,
  userFriendSchema,
  userOnlineStatusSchema,
  user2FASchema,
  user2FATempSchema
} from "./schemas/users";

import {
  postSchema,
  photoSchema,
  postLikeSchema,
  postCommentSchema
} from "./schemas/social";

import {
  tournamentSchema,
  tournamentPlayerSchema,
  tournamentMatchSchema,
  gameSchema,
  userStatsSchema
} from "./schemas/gaming";

import {
  chatMessageSchema
} from "./schemas/chat";

import {
  newsSchema
} from "./schemas/news";

export function initializeDatabase() {

  // User tables
  db.prepare(userSchema).run();
  db.prepare(userFriendSchema).run();
  db.prepare(userOnlineStatusSchema).run();  // ADD THIS LINE
  db.prepare(user2FASchema).run(); // Add this
  db.prepare(user2FATempSchema).run(); // Add this

  // Migration: Ensure relationship_status column exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasRelStatus = tableInfo.some(col => col.name === 'relationship_status');
    if (!hasRelStatus) {
      db.prepare("ALTER TABLE users ADD COLUMN relationship_status TEXT").run();
    }
  } catch (err) {
  }

  // Password reset table
  try {
    // password_resets schema may be defined in schemas/users
    // we import it lazily to avoid ordering issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { passwordResetSchema } = require('./schemas/users');
    if (passwordResetSchema) db.prepare(passwordResetSchema).run();
  } catch (err) {
    console.warn('password_resets schema not found or failed to create:', err);
  }
  // Social tables
  db.prepare(postSchema).run();
  db.prepare(photoSchema).run();
  db.prepare(postLikeSchema).run();
  db.prepare(postCommentSchema).run();

  // Gaming tables
  db.prepare(tournamentSchema).run();
  db.prepare(tournamentPlayerSchema).run();
  db.prepare(tournamentMatchSchema).run();
  db.prepare(gameSchema).run();
  db.prepare(userStatsSchema).run();

  // Chat tables
  db.prepare(chatMessageSchema).run();

  // News table
  db.prepare(newsSchema).run();

  // Migration: Add match acceptance columns to tournament_matches
  try {
    const matchesTableInfo = db.prepare("PRAGMA table_info(tournament_matches)").all() as any[];
    const hasPlayer1Accepted = matchesTableInfo.some(col => col.name === 'player1_accepted');
    const hasPlayer2Accepted = matchesTableInfo.some(col => col.name === 'player2_accepted');

    if (!hasPlayer1Accepted) {
      db.prepare("ALTER TABLE tournament_matches ADD COLUMN player1_accepted INTEGER DEFAULT 0").run();
    }

    if (!hasPlayer2Accepted) {
      db.prepare("ALTER TABLE tournament_matches ADD COLUMN player2_accepted INTEGER DEFAULT 0").run();
    }
  } catch (err) {
  }

  // Migration: Add tournament_points column to users table
  try {
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasTournamentPoints = usersTableInfo.some(col => col.name === 'tournament_points');

    if (!hasTournamentPoints) {
      db.prepare("ALTER TABLE users ADD COLUMN tournament_points INTEGER DEFAULT 0").run();
    }
  } catch (err) {
  }

  // Migration: Add stats_reset_at column to users table
  try {
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasStatsResetAt = usersTableInfo.some(col => col.name === 'stats_reset_at');

    if (!hasStatsResetAt) {
      db.prepare("ALTER TABLE users ADD COLUMN stats_reset_at TEXT").run();
      // Set stats_reset_at to current time for all existing users
      // This ensures they start fresh from now
      db.prepare("UPDATE users SET stats_reset_at = datetime('now') WHERE stats_reset_at IS NULL").run();
    }
  } catch (err) {
  }

  // Migration: Add event_date column to news table
  try {
    const newsTableInfo = db.prepare("PRAGMA table_info(news)").all() as any[];
    const hasEventDate = newsTableInfo.some(col => col.name === 'event_date');

    if (!hasEventDate) {
      db.prepare("ALTER TABLE news ADD COLUMN event_date TEXT").run();
    }
  } catch (err) {
  }


  // Ensure an initial admin user exists (created once on first startup)
  try {
    const existingAdmin = db.prepare("SELECT id FROM users WHERE username = ?").get('admin');
    if (!existingAdmin) {
      // Use bcryptjs synchronously to avoid async startup complications
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bcrypt = require('bcryptjs');
      const passwordHash = bcrypt.hashSync('admin', 10);

      const insert = db.prepare(`
        INSERT INTO users (username, email, password_hash, created_at, status)
        VALUES (?, ?, ?, datetime('now'), 'admin')
      `).run('admin', 'admin@example.com', passwordHash);

      const adminId = insert.lastInsertRowid as number;
      // Initialize stats row for admin
      db.prepare(`
        INSERT OR IGNORE INTO user_stats (user_id, updated_at) VALUES (?, datetime('now'))
      `).run(adminId);

    }
  } catch (err) {
  }
}