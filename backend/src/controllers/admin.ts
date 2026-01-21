import { FastifyInstance } from "fastify";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');
import db from "../models";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for admin routes");
}

interface CreateUserItem {
  username: string;
  email: string;
  password: string;
}

// Helper function to verify admin access
function verifyAdminToken(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded && decoded.username === 'admin';
  } catch (err) {
    return false;
  }
}

export default async function adminRoutes(fastify: FastifyInstance) {
  // Generate 10 connected users (all friends with each other)
  fastify.post("/admin/generate-connected-users", async (request, reply) => {
    try {
      if (!verifyAdminToken(request.headers.authorization)) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const locations = ['Beirut', 'Paris', 'London', 'Tokyo', 'New York', 'Berlin', 'Sydney', 'Dubai', 'Rome', 'Madrid'];
      const educationOptions = ['High School', 'Bachelors in Computer Science', 'Masters in Engineering', 'PhD in Physics', 'Self-taught Developer', 'MBA', 'Medical Degree'];
      const genderOptions = ['male', 'female', 'non-binary'];
      const bios = [
        'Love playing Pong! Always up for a challenge.',
        'Competitive gamer and tech enthusiast.',
        'Pong champion in the making!',
        'Just here to have fun and meet new people.',
        'Passionate about gaming and technology.',
        'Looking for worthy opponents!',
        'Casual player, serious about fun.',
        'Gaming is life! Let\'s play!',
        'Always learning, always improving.',
        'Here to dominate the leaderboard!'
      ];

      const created: any[] = [];
      const userIds: number[] = [];

      // Create users 1-10
      for (let i = 1; i <= 10; i++) {
        const username = `user${i}`;
        const email = `user${i}@example.com`;
        const password = `password${i}`;

        // Check if user already exists
        const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (exists) {
          return reply.status(400).send({ error: `User ${username} already exists. Please delete existing users first.` });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        // Assign locations with variety (4 from Beirut, 3 from Paris, etc.)
        let location;
        if (i <= 4) location = 'Beirut';
        else if (i <= 7) location = 'Paris';
        else if (i <= 9) location = 'London';
        else location = 'Tokyo';

        const education = educationOptions[Math.floor(Math.random() * educationOptions.length)];
        const gender = genderOptions[Math.floor(Math.random() * genderOptions.length)];
        const bio = bios[i - 1];
        const fullname = `Test User ${i}`;

        const insert = db.prepare(`
          INSERT INTO users (username, email, password_hash, lives_in, education, gender, bio, fullname, created_at, stats_reset_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(username, email, passwordHash, location, education, gender, bio, fullname);

        const userId = insert.lastInsertRowid as number;
        userIds.push(userId);

        // Random stats
        const totalGames = Math.floor(Math.random() * 50) + 10;
        const wins = Math.floor(Math.random() * totalGames);
        const losses = totalGames - wins;
        const totalPointsScored = Math.floor(Math.random() * 3000) + 500;
        const totalPointsConceded = Math.floor(Math.random() * 3000) + 500;

        db.prepare(`
          INSERT OR REPLACE INTO user_stats (
            user_id, total_games, wins, losses, win_streak, max_win_streak, total_points_scored, total_points_conceded, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(userId, totalGames, wins, losses, 0, Math.floor(Math.random() * 10), totalPointsScored, totalPointsConceded);

        created.push({ id: userId, username, email, location });
      }

      // Create friend relationships (all users are friends with each other)
      let friendshipsCreated = 0;
      for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
          // Create bidirectional friendship
          db.prepare(`
            INSERT INTO user_friends (user_id, friend_id, status, created_at, updated_at)
            VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
          `).run(userIds[i], userIds[j]);

          db.prepare(`
            INSERT INTO user_friends (user_id, friend_id, status, created_at, updated_at)
            VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
          `).run(userIds[j], userIds[i]);

          friendshipsCreated += 2;
        }
      }

      // Generate realistic game history for each user
      let gamesCreated = 0;
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const userStats = db.prepare('SELECT wins, losses FROM user_stats WHERE user_id = ?').get(userId) as any;
        const totalGames = (userStats.wins || 0) + (userStats.losses || 0);

        // Create games against other users
        for (let gameNum = 0; gameNum < totalGames; gameNum++) {
          // Pick a random opponent from the other users
          let opponentIdx = Math.floor(Math.random() * userIds.length);
          while (opponentIdx === i) {
            opponentIdx = Math.floor(Math.random() * userIds.length);
          }
          const opponentId = userIds[opponentIdx];

          // Determine winner based on user's win rate
          const shouldWin = gameNum < userStats.wins;
          const winnerId = shouldWin ? userId : opponentId;

          // Random scores (winner gets 11, loser gets 0-10)
          const winnerScore = 5;
          const loserScore = Math.floor(Math.random() * 5);

          const player1Id = userId;
          const player2Id = opponentId;
          const scorePlayer1 = shouldWin ? winnerScore : loserScore;
          const scorePlayer2 = shouldWin ? loserScore : winnerScore;

          // Create game record with random date in the past month
          const daysAgo = Math.floor(Math.random() * 30);
          db.prepare(`
            INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now', '-${daysAgo} days'))
          `).run(player1Id, player2Id, winnerId, scorePlayer1, scorePlayer2);

          gamesCreated++;
        }
      }

      return reply.send({
        created,
        friendshipsCreated,
        gamesCreated,
        message: `Created users 1-10 (all friends with each other, ${gamesCreated} games generated)`
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Generate 10 standalone users (no friends)
  fastify.post("/admin/generate-standalone-users", async (request, reply) => {
    try {
      if (!verifyAdminToken(request.headers.authorization)) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const locations = ['Beirut', 'Paris', 'London', 'Tokyo', 'New York', 'Berlin', 'Sydney', 'Dubai', 'Rome', 'Madrid'];
      const educationOptions = ['High School', 'Bachelors in Computer Science', 'Masters in Engineering', 'PhD in Physics', 'Self-taught Developer', 'MBA', 'Medical Degree'];
      const genderOptions = ['male', 'female', 'non-binary'];
      const bios = [
        'New to Pong, looking to learn!',
        'Just started playing, be gentle!',
        'Exploring the game and meeting people.',
        'Casual player seeking friends.',
        'Here to improve my skills.',
        'Love the competitive spirit!',
        'Gaming enthusiast and beginner.',
        'Looking for practice partners.',
        'Excited to join the community!',
        'Ready to start my Pong journey!'
      ];

      const created: any[] = [];

      // Create users 11-20
      for (let i = 11; i <= 20; i++) {
        const username = `user${i}`;
        const email = `user${i}@example.com`;
        const password = `password${i}`;

        // Check if user already exists
        const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (exists) {
          return reply.status(400).send({ error: `User ${username} already exists. Please delete existing users first.` });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        // Distribute locations evenly
        const location = locations[(i - 11) % locations.length];
        const education = educationOptions[Math.floor(Math.random() * educationOptions.length)];
        const gender = genderOptions[Math.floor(Math.random() * genderOptions.length)];
        const bio = bios[i - 11];
        const fullname = `Solo User ${i}`;

        const insert = db.prepare(`
          INSERT INTO users (username, email, password_hash, lives_in, education, gender, bio, fullname, created_at, stats_reset_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(username, email, passwordHash, location, education, gender, bio, fullname);

        const userId = insert.lastInsertRowid as number;

        // Random stats (lower for standalone users)
        const totalGames = Math.floor(Math.random() * 20) + 1;
        const wins = Math.floor(Math.random() * totalGames);
        const losses = totalGames - wins;
        const totalPointsScored = Math.floor(Math.random() * 1000) + 100;
        const totalPointsConceded = Math.floor(Math.random() * 1000) + 100;

        db.prepare(`
          INSERT OR REPLACE INTO user_stats (
            user_id, total_games, wins, losses, win_streak, max_win_streak, total_points_scored, total_points_conceded, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(userId, totalGames, wins, losses, 0, Math.floor(Math.random() * 5), totalPointsScored, totalPointsConceded);

        created.push({ id: userId, username, email, location });
      }

      // Generate realistic game history for standalone users
      // They play against each other (user11-20)
      let gamesCreated = 0;
      const userIdsArray = created.map(u => u.id);

      for (let i = 0; i < userIdsArray.length; i++) {
        const userId = userIdsArray[i];
        const userStats = db.prepare('SELECT wins, losses FROM user_stats WHERE user_id = ?').get(userId) as any;
        const totalGames = (userStats.wins || 0) + (userStats.losses || 0);

        // Create games against other standalone users
        for (let gameNum = 0; gameNum < totalGames; gameNum++) {
          // Pick a random opponent from the other standalone users
          let opponentIdx = Math.floor(Math.random() * userIdsArray.length);
          while (opponentIdx === i) {
            opponentIdx = Math.floor(Math.random() * userIdsArray.length);
          }
          const opponentId = userIdsArray[opponentIdx];

          // Determine winner based on user's win rate
          const shouldWin = gameNum < userStats.wins;
          const winnerId = shouldWin ? userId : opponentId;

          // Random scores (winner gets 11, loser gets 0-10)
          const winnerScore = 11;
          const loserScore = Math.floor(Math.random() * 11);

          const player1Id = userId;
          const player2Id = opponentId;
          const scorePlayer1 = shouldWin ? winnerScore : loserScore;
          const scorePlayer2 = shouldWin ? loserScore : winnerScore;

          // Create game record with random date in the past 2 weeks
          const daysAgo = Math.floor(Math.random() * 14);
          db.prepare(`
            INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now', '-${daysAgo} days'))
          `).run(player1Id, player2Id, winnerId, scorePlayer1, scorePlayer2);

          gamesCreated++;
        }
      }

      return reply.send({
        created,
        gamesCreated,
        message: `Created users 11-20 (no friends, ${gamesCreated} games generated)`
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create multiple users (admin only)
  fastify.post<{ Body: { users: CreateUserItem[] } }>(
    "/admin/create-users",
    async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.status(401).send({ error: 'Authentication required' });
        }

        const token = authHeader.substring(7);
        let decoded: any;
        try {
          decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
          return reply.status(401).send({ error: 'Invalid token' });
        }

        if (!decoded || decoded.username !== 'admin') {
          return reply.status(403).send({ error: 'Admin access required' });
        }

        const items = request.body?.users || [];
        if (!Array.isArray(items) || items.length === 0) {
          return reply.status(400).send({ error: 'No users provided' });
        }

        const created: any[] = [];

        for (const item of items) {
          const username = String(item.username).trim();
          const email = String(item.email).trim();
          const password = String(item.password || 'password');

          // Basic validation
          if (!username || !email) continue;

          const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
          if (exists) continue;

          const passwordHash = bcrypt.hashSync(password, 10);

          // Random profile fields
          const livesInOptions = ['New York', 'London', 'Paris', 'Berlin', 'Tokyo', 'Sydney', 'Cairo'];
          const educationOptions = ['High School', 'Bachelors', 'Masters', 'PhD', 'Self-taught'];
          const genderOptions = ['male', 'female', 'non-binary'];

          const lives_in = livesInOptions[Math.floor(Math.random() * livesInOptions.length)];
          const education = educationOptions[Math.floor(Math.random() * educationOptions.length)];
          const gender = genderOptions[Math.floor(Math.random() * genderOptions.length)];

          const insert = db.prepare(`
            INSERT INTO users (username, email, password_hash, lives_in, education, gender, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(username, email, passwordHash, lives_in, education, gender);

          const userId = insert.lastInsertRowid as number;

          // Random stats
          const totalGames = Math.floor(Math.random() * 100) + 1;
          const wins = Math.floor(Math.random() * totalGames);
          const losses = totalGames - wins;
          const totalPointsScored = Math.floor(Math.random() * 5000);
          const totalPointsConceded = Math.floor(Math.random() * 5000);

          db.prepare(`
            INSERT OR REPLACE INTO user_stats (
              user_id, total_games, wins, losses, win_streak, max_win_streak, total_points_scored, total_points_conceded, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(userId, totalGames, wins, losses, 0, 0, totalPointsScored, totalPointsConceded);

          created.push({ id: userId, username, email });
        }

        return reply.send({ created });
      } catch (err) {
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // List users (admin only)
  fastify.get('/admin/users', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const token = authHeader.substring(7);
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      if (!decoded || decoded.username !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const users = db.prepare(`
        SELECT id, username, email, picture, fullname, created_at, deleted
        FROM users
        ORDER BY id DESC
      `).all();

      return reply.send({ users });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete (hard-delete) user by id (admin only)
  fastify.delete<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const token = authHeader.substring(7);
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      if (!decoded || decoded.username !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const id = Number(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid user id' });

      // Check if user is admin
      const userToDelete = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as any;
      if (userToDelete && userToDelete.username === 'admin') {
        return reply.status(403).send({ error: 'Admin account cannot be deleted' });
      }

      // Hard-delete the user and all related data
      // Delete in order to respect foreign key constraints
      
      // Delete user-related data from all tables
      db.prepare('DELETE FROM user_friends WHERE user_id = ? OR friend_id = ?').run(id, id);
      db.prepare('DELETE FROM user_online_status WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM user_2fa WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM user_2fa_temp WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM chat_messages WHERE sender_id = ? OR receiver_id = ?').run(id, id);
      db.prepare('DELETE FROM tournament_players WHERE user_id = ?').run(id);
      
      // Delete tournament matches where user participated
      db.prepare('DELETE FROM tournament_matches WHERE player1_id = ? OR player2_id = ? OR winner_id = ?').run(id, id, id);
      
      // Delete tournaments created by user
      db.prepare('DELETE FROM tournaments WHERE created_by = ?').run(id);
      
      // Delete games where user participated
      db.prepare('DELETE FROM games WHERE player1_id = ? OR player2_id = ? OR winner_id = ?').run(id, id, id);
      
      // Delete user stats
      db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(id);
      
      // Finally delete the user
      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
    }
  });
}
