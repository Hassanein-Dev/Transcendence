export const tournamentSchema = `
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  max_players INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'waiting',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY(created_by) REFERENCES users(id)
)`;

export const tournamentPlayerSchema = `
CREATE TABLE IF NOT EXISTS tournament_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  position INTEGER,
  UNIQUE(tournament_id, user_id),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`;

export const tournamentMatchSchema = `
CREATE TABLE IF NOT EXISTS tournament_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id INTEGER,
  player2_id INTEGER,
  winner_id INTEGER,
  score_player1 INTEGER DEFAULT 0,
  score_player2 INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY(player1_id) REFERENCES users(id),
  FOREIGN KEY(player2_id) REFERENCES users(id),
  FOREIGN KEY(winner_id) REFERENCES users(id)
)`;

export const gameSchema = `
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player1_id INTEGER NOT NULL,
  player2_id INTEGER NOT NULL,
  winner_id INTEGER,
  score_player1 INTEGER DEFAULT 0,
  score_player2 INTEGER DEFAULT 0,
  game_type TEXT DEFAULT '1v1',
  tournament_match_id INTEGER,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  duration INTEGER,
  FOREIGN KEY(player1_id) REFERENCES users(id),
  FOREIGN KEY(player2_id) REFERENCES users(id),
  FOREIGN KEY(winner_id) REFERENCES users(id),
  FOREIGN KEY(tournament_match_id) REFERENCES tournament_matches(id)
)`;

export const userStatsSchema = `
CREATE TABLE IF NOT EXISTS user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  max_win_streak INTEGER DEFAULT 0,
  total_points_scored INTEGER DEFAULT 0,
  total_points_conceded INTEGER DEFAULT 0,
  average_points_per_game REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`;

// Import database connection
import db from '../connection';

// Tournament helper functions
export function addTournamentPointsToUser(userId: number, points: number): void {
  const stmt = db.prepare(`
    UPDATE users 
    SET tournament_points = COALESCE(tournament_points, 0) + ? 
    WHERE id = ?
  `);
  stmt.run(points, userId);

}

export function getTournamentPlayers(tournamentId: string): any[] {
  const stmt = db.prepare(`
    SELECT DISTINCT user_id as userId, username 
    FROM tournament_players tp
    JOIN users u ON tp.user_id = u.id
    WHERE tp.tournament_id = ?
  `);
  return stmt.all(tournamentId);
}

export function deleteTournament(tournamentId: string): void {
  const stmt = db.prepare('DELETE FROM tournaments WHERE id = ?');
  stmt.run(tournamentId);
}

export function deleteMatchesByTournamentId(tournamentId: string): void {
  const stmt = db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?');
  stmt.run(tournamentId);
}
