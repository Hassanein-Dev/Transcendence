import db from "./connection";
import { initializeDatabase } from "./init";

// Initialize database on import
initializeDatabase();

// Export database instance
export default db;

// Export table names as constants for use in queries
export const TABLES = {
  USERS: 'users',
  USER_FRIENDS: 'user_friends',
  POSTS: 'posts',
  PHOTOS: 'photos',
  POST_LIKES: 'post_likes',
  POST_COMMENTS: 'post_comments',
  TOURNAMENTS: 'tournaments',
  TOURNAMENT_PLAYERS: 'tournament_players',
  TOURNAMENT_MATCHES: 'tournament_matches',
  GAMES: 'games',
  USER_STATS: 'user_stats',
  CHAT_MESSAGES: 'chat_messages',
  NEWS: 'news'
} as const;
