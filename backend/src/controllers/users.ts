import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import db from "../models";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me_in_production";

// Expanded to include all profile fields
interface UpdateUserBody {
  username?: string;
  avatarUrl?: string;
  fullname?: string;
  bio?: string;
  lives_in?: string;
  education?: string;
  birthday?: string;
  gender?: string;
  phone?: string;
  cover_photo?: string;
  relationship_status?: string;
}

// Helper to extract user ID from JWT token
function getUserIdFromToken(request: FastifyRequest): number | null {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId;
  } catch {
    return null;
  }
}

export default async function userRoutes(fastify: FastifyInstance) {
  // Get user profile - UPDATED to return all fields + relationship status
  // view a user's profile by id, authuserid is the user who is requesting the profile
  fastify.get("/users/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;
    const authUserId = getUserIdFromToken(request); // Get authenticated user ID

    const user = db.prepare(`
      SELECT 
        id,
        username,
        email,
        picture as avatarUrl,
        fullname,
        bio,
        lives_in,
        education,
        birthday,
        gender,
        phone,
        cover_photo as coverPhoto,
        created_at as createdAt
      FROM users 
      WHERE id = ? AND deleted = 0
    `).get(id);

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Get user stats (only games after stats_reset_at)
    const userResetTime = db.prepare(`
      SELECT stats_reset_at FROM users WHERE id = ?
    `).get(id) as { stats_reset_at: string | null } | undefined;

    const resetAt = userResetTime?.stats_reset_at || '1970-01-01';

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalGames,
        SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN winner_id != ? AND winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
      FROM games 
      WHERE (player1_id = ? OR player2_id = ?) 
        AND created_at >= ?
    `).get(id, id, id, id, resetAt);

    // Get friend count - count unique friendships where status is accepted
    // Each friendship is stored once with user_id as requester and friend_id as accepter
    const friendCount = db.prepare(`
      SELECT COUNT(DISTINCT 
        CASE 
          WHEN user_id = ? THEN friend_id 
          WHEN friend_id = ? THEN user_id 
        END
      ) as count
      FROM user_friends
      WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
    `).get(id, id, id, id) as { count: number };

    // Determine relationship with authenticated user (if logged in)
    let relationship = null;
    if (authUserId && authUserId !== parseInt(id)) {
      const friendship = db.prepare(`
        SELECT status, user_id, friend_id
        FROM user_friends
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      `).get(authUserId, id, id, authUserId) as any;

      if (friendship) {
        if (friendship.status === 'accepted') {
          relationship = 'friend';
        } else if (friendship.status === 'pending') {
          // Check who sent the request
          if (friendship.user_id === authUserId) {
            relationship = 'pending'; // I sent the request
          } else {
            relationship = 'requested'; // They sent me a request
          }
        } else if (friendship.status === 'blocked') {
          relationship = 'blocked';
        }
      }
    }

    return {
      ...user,
      friendCount: friendCount.count || 0,
      relationship,
      stats: {
        totalGames: stats.totalGames || 0,
        wins: stats.wins || 0,
        losses: stats.losses || 0
      }
    };
  });

  // Update user profile - UPDATED to handle all profile fields
  fastify.put<{ Params: { id: string }, Body: UpdateUserBody }>(
    "/users/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const {
          username, avatarUrl, fullname, bio, lives_in, education,
          birthday, gender, phone, cover_photo, relationship_status
        } = request.body;

        // Verify user exists
        const existingUser = db.prepare("SELECT id FROM users WHERE id = ? AND deleted = 0").get(id);
        if (!existingUser) {
          return reply.status(404).send({ error: "User not found" });
        }

        // Build dynamic update query
        const updates: string[] = [];
        const params: any[] = [];

        // Map frontend fields to database columns
        if (username !== undefined) {
          updates.push("username = ?");
          params.push(username);
        }
        if (avatarUrl !== undefined) {
          updates.push("picture = ?");  // Database uses 'picture', not 'avatar_url'
          params.push(avatarUrl);
        }
        if (fullname !== undefined) {
          updates.push("fullname = ?");
          params.push(fullname);
        }
        if (bio !== undefined) {
          updates.push("bio = ?");
          params.push(bio);
        }
        if (lives_in !== undefined) {
          updates.push("lives_in = ?");
          params.push(lives_in);
        }
        if (education !== undefined) {
          updates.push("education = ?");
          params.push(education);
        }
        if (birthday !== undefined) {
          updates.push("birthday = ?");
          params.push(birthday);
        }
        if (gender !== undefined) {
          updates.push("gender = ?");
          params.push(gender);
        }
        if (phone !== undefined) {
          updates.push("phone = ?");
          params.push(phone);
        }
        if (cover_photo !== undefined) {
          updates.push("cover_photo = ?");
          params.push(cover_photo);
        }
        if (relationship_status !== undefined) {
          updates.push("relationship_status = ?");
          params.push(relationship_status);
        }

        if (updates.length === 0) {
          return reply.status(400).send({ error: "No fields to update" });
        }

        params.push(id);

        // Execute update
        const stmt = db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`);
        stmt.run(...params);

        // Return updated user
        const updatedUser = db.prepare(`
        SELECT 
          id, username, email, picture as avatarUrl, fullname, bio, 
          lives_in as livesIn, education, birthday, gender, phone,
          cover_photo as coverPhoto, relationship_status as relationshipStatus, created_at as createdAt
        FROM users WHERE id = ?
      `).get(id);

        return reply.send(updatedUser);

      } catch (error) {
        return reply.status(500).send({ error: "Failed to update profile" });
      }
    }
  );

  // Search users - KEEP AS IS
  fastify.get("/users", async (request: FastifyRequest<{ Querystring: { q: string } }>, reply) => {
    const { q } = request.query;

    if (!q || q.length < 2) {
      return reply.status(400).send({ error: "Search query must be at least 2 characters" });
    }

    const users = db.prepare(`
      SELECT 
        id,
        username,
        avatar_url as avatarUrl,
        created_at as createdAt
      FROM users 
      WHERE username LIKE ? AND deleted = 0
      LIMIT 10
    `).all(`%${q}%`);

    return users;
  });

  // Get user game history - only games after stats_reset_at
  fastify.get("/users/:id/games", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    // Get user's stats reset timestamp
    const userResetTime = db.prepare(`
      SELECT stats_reset_at FROM users WHERE id = ?
    `).get(id) as { stats_reset_at: string | null } | undefined;

    const resetAt = userResetTime?.stats_reset_at || '1970-01-01';

    const games = db.prepare(`
      SELECT 
        g.id,
        g.player1_id as player1Id,
        g.player2_id as player2Id,
        g.winner_id as winnerId,
        g.score_player1 as scorePlayer1,
        g.score_player2 as scorePlayer2,
        g.created_at as createdAt,
        u1.username as player1Username,
        u2.username as player2Username
      FROM games g
      LEFT JOIN users u1 ON g.player1_id = u1.id
      LEFT JOIN users u2 ON g.player2_id = u2.id
      WHERE (g.player1_id = ? OR g.player2_id = ?) 
        AND g.winner_id IS NOT NULL
        AND g.created_at >= ?
      ORDER BY g.created_at DESC
      LIMIT 20
    `).all(id, id, resetAt);

    return games;
  });

  // Upload avatar
  fastify.post<{ Params: { id: string }, Body: { avatarUrl: string } }>(
    "/users/:id/avatar",
    async (request, reply) => {
      const { id } = request.params;
      const { avatarUrl } = request.body;

      if (!avatarUrl) {
        return reply.status(400).send({ error: "avatarUrl is required" });
      }

      db.prepare(`
        UPDATE users SET avatar_url = ? WHERE id = ?
      `).run(avatarUrl, id);

      return {
        success: true,
        avatarUrl
      };
    }
  );

  // GDPR: Delete (Anonymize) User
  fastify.delete("/users/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    // Verify auth (implementation pending, for now assuming middleware handles it or we check session)
    // In a real app, check if request.user.id === id || request.user.isAdmin

    try {

      // Anonymize user data but keep ID for game history integrity
      const anonymizedName = `User ${id} (Deleted)`;
      const anonymizedEmail = `deleted_${id}_${Date.now()}@anonymized.local`; // Unique placeholder

      const stmt = db.prepare(`
        UPDATE users 
        SET 
          username = ?,
          email = ?,
          password_hash = 'DELETED',
          picture = NULL,
          github_id = NULL,
          fullname = NULL,
          bio = NULL,
          lives_in = NULL,
          from_place = NULL,
          education = NULL,
          birthday = NULL,
          gender = NULL,
          phone = NULL,
          cover_photo = NULL,
          two_factor_enabled = 0,
          two_factor_secret = NULL,
          deleted = 1
        WHERE id = ?
      `);

      const info = stmt.run(anonymizedName, anonymizedEmail, id);

      if (info.changes === 0) {
        return reply.status(404).send({ error: "User not found" });
      }

      return { success: true, message: "Account deleted and data anonymized" };

    } catch (error) {
      return reply.status(500).send({ error: "Failed to delete account" });
    }
  });

  // Get leaderboard - top players ranked by wins (only games after stats_reset_at)
  fastify.get("/users/leaderboard", async (request: FastifyRequest<{ Querystring: { page?: string, limit?: string } }>, reply) => {
    const page = Math.max(1, parseInt(request.query.page || '1'));
    const limit = Math.max(1, parseInt(request.query.limit || '10'));
    const offset = (page - 1) * limit;

    try {
      // Get total count of players with wins > 0
      const countResult = db.prepare(`
        SELECT COUNT(*) as total
        FROM (
          SELECT u.id
          FROM users u
          LEFT JOIN games g ON (
            (g.player1_id = u.id OR g.player2_id = u.id) 
            AND g.created_at >= COALESCE(u.stats_reset_at, '1970-01-01')
          )
          WHERE u.deleted = 0
          GROUP BY u.id
          HAVING SUM(CASE WHEN g.winner_id = u.id THEN 1 ELSE 0 END) > 0
        )
      `).get() as { total: number };

      const totalPlayers = countResult.total || 0;
      const totalPages = Math.ceil(totalPlayers / limit);

      const players = db.prepare(`
        SELECT 
          u.id,
          u.username,
          u.picture as avatarUrl,
          u.fullname,
          COUNT(g.id) as totalGames,
          SUM(CASE WHEN g.winner_id = u.id THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN g.winner_id != u.id AND g.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
        FROM users u
        LEFT JOIN games g ON (
          (g.player1_id = u.id OR g.player2_id = u.id) 
          AND g.created_at >= COALESCE(u.stats_reset_at, '1970-01-01')
        )
        WHERE u.deleted = 0
        GROUP BY u.id
        HAVING wins > 0
        ORDER BY wins DESC, totalGames ASC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      return {
        players,
        total: totalPlayers,
        page,
        totalPages
      };
    } catch (error) {
      return reply.status(500).send({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get user activities (computed from games, friends, tournaments)
  fastify.get("/users/:id/activities", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    try {
      const activities: any[] = [];

      // 1. Recent games (last 30 days)
      const recentGames = db.prepare(`
        SELECT 
          g.id,
          g.player1_id,
          g.player2_id,
          g.winner_id,
          g.score_player1,
          g.score_player2,
          g.created_at,
          u1.username as opponent_username
        FROM games g
        LEFT JOIN users u1 ON (
          CASE 
            WHEN g.player1_id = ? THEN g.player2_id 
            ELSE g.player1_id 
          END = u1.id
        )
        WHERE (g.player1_id = ? OR g.player2_id = ?)
          AND g.winner_id IS NOT NULL
          AND datetime(g.created_at) > datetime('now', '-30 days')
        ORDER BY g.created_at DESC
        LIMIT 10
      `).all(id, id, id);

      recentGames.forEach((game: any) => {
        const won = game.winner_id === parseInt(id);
        const score = game.player1_id === parseInt(id)
          ? `${game.score_player1}-${game.score_player2}`
          : `${game.score_player2}-${game.score_player1}`;

        activities.push({
          type: 'game',
          icon: '🎮',
          title: won ? 'Won a match' : 'Played a match',
          description: won
            ? `Victory against ${game.opponent_username} (${score})`
            : `Lost to ${game.opponent_username} (${score})`,
          timestamp: game.created_at,
          createdAt: game.created_at
        });
      });

      // 2. Recent friend connections (last 30 days)
      // Get unique friendships by selecting only the user's direction
      // Use updated_at (requester) or created_at (receiver) to determine when friendship started
      const recentFriends = db.prepare(`
        SELECT
          uf.friend_id as other_user_id,
          COALESCE(uf.updated_at, uf.created_at) as timestamp,
          u.username as friend_username
        FROM user_friends uf
        JOIN users u ON u.id = uf.friend_id
        WHERE uf.user_id = ?
          AND uf.status = 'accepted'
          AND datetime(COALESCE(uf.updated_at, uf.created_at)) > datetime('now', '-30 days')
        ORDER BY timestamp DESC
        LIMIT 5
      `).all(id);

      recentFriends.forEach((friend: any) => {
        activities.push({
          type: 'friend',
          icon: '👥',
          title: 'New friend',
          description: `Connected with ${friend.friend_username}`,
          timestamp: friend.timestamp,
          createdAt: friend.timestamp,
          uniqueId: `friend-${friend.other_user_id}-${friend.timestamp}` // Unique per friend+timestamp
        });
      });

      // 3. Achievement-based activities (computed from stats)
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as totalGames,
          SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
        FROM games 
        WHERE (player1_id = ? OR player2_id = ?)
          AND winner_id IS NOT NULL
      `).get(id, id, id) as any;

      // Check for win streak achievement
      if (stats.wins && stats.wins >= 5) {
        const winStreakGames = db.prepare(`
          SELECT created_at
          FROM games
          WHERE (player1_id = ? OR player2_id = ?)
            AND winner_id = ?
          ORDER BY created_at DESC
          LIMIT 5
        `).all(id, id, id);

        if (winStreakGames.length === 5) {
          activities.push({
            type: 'achievement',
            icon: '🏆',
            title: 'Achievement unlocked',
            description: `Won ${stats.wins >= 10 ? '10' : '5'} games${stats.wins >= 10 ? ' in total' : ''}`,
            timestamp: winStreakGames[0].created_at,
            createdAt: winStreakGames[0].created_at
          });
        }
      }

      // 4. Tournament participations (last 30 days)
      const recentTournaments = db.prepare(`
        SELECT 
          t.id,
          t.name,
          t.status,
          tp.joined_at,
          tp.position
        FROM tournament_players tp
        JOIN tournaments t ON tp.tournament_id = t.id
        WHERE tp.user_id = ?
          AND datetime(tp.joined_at) > datetime('now', '-30 days')
        ORDER BY tp.joined_at DESC
        LIMIT 5
      `).all(id);

      recentTournaments.forEach((tournament: any) => {
        let description = `Joined ${tournament.name}`;
        if (tournament.status === 'completed' && tournament.position) {
          description = `Finished #${tournament.position} in ${tournament.name}`;
        }

        activities.push({
          type: 'tournament',
          icon: tournament.position === 1 ? '🥇' : '🏆',
          title: tournament.status === 'completed' ? 'Tournament completed' : 'Joined tournament',
          description,
          timestamp: tournament.joined_at,
          createdAt: tournament.joined_at
        });
      });

      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Remove duplicates based on type and timestamp (in case of race conditions)
      const uniqueActivities = activities.filter((activity, index, self) => {
        return index === self.findIndex((a) => (
          a.type === activity.type &&
          a.timestamp === activity.timestamp &&
          a.description === activity.description
        ));
      });

      // Return top 15 activities with formatted time
      const formattedActivities = uniqueActivities.slice(0, 15).map(activity => ({
        ...activity,
        time: formatRelativeTime(activity.timestamp)
      }));

      return formattedActivities;

    } catch (error) {
      return reply.status(500).send({ error: "Failed to fetch activities" });
    }
  });

  // Helper function to format relative time
  function formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
  }

  // Save regular game result
  fastify.post<{
    Body: {
      player1Id: string;
      player2Id: string;
      winnerId: string;
      scores: [number, number];
      gameType?: string;
    }
  }>(
    "/games/save-result",
    async (request, reply) => {
      const { player1Id, player2Id, winnerId, scores, gameType = 'multiplayer' } = request.body;

      try {
        // Save game to games table
        const gameResult = db.prepare(`
          INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, game_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          player1Id,
          player2Id,
          winnerId,
          scores[0],
          scores[1],
          gameType,
          new Date().toISOString()
        );

        // Update user stats for winner
        const winnerStats = db.prepare(`
          SELECT * FROM user_stats WHERE user_id = ?
        `).get(winnerId);

        if (winnerStats) {
          db.prepare(`
            UPDATE user_stats SET 
              total_games = total_games + 1,
              wins = wins + 1,
              updated_at = ?
            WHERE user_id = ?
          `).run(new Date().toISOString(), winnerId);
        } else {
          db.prepare(`
            INSERT INTO user_stats (user_id, total_games, wins, losses, total_points_scored, total_points_conceded, updated_at)
            VALUES (?, 1, 1, 0, 0, 0, ?)
          `).run(winnerId, new Date().toISOString());
        }

        // Update user stats for loser
        const loserId = winnerId === player1Id ? player2Id : player1Id;
        const loserStats = db.prepare(`
          SELECT * FROM user_stats WHERE user_id = ?
        `).get(loserId);

        if (loserStats) {
          db.prepare(`
            UPDATE user_stats SET 
              total_games = total_games + 1,
              losses = losses + 1,
              updated_at = ?
            WHERE user_id = ?
          `).run(new Date().toISOString(), loserId);
        } else {
          db.prepare(`
            INSERT INTO user_stats (user_id, total_games, wins, losses, total_points_scored, total_points_conceded, updated_at)
            VALUES (?, 1, 0, 1, 0, 0, ?)
          `).run(loserId, new Date().toISOString());
        }

        return reply.send({
          success: true,
          gameId: gameResult.lastInsertRowid,
          message: "Game result saved successfully"
        });

      } catch (error) {
        return reply.status(500).send({ error: "Failed to save game result" });
      }
    }
  );
}