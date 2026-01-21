import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import db from "../models";
import jwt from "jsonwebtoken";
import { handleFriendRequest, handleFriendStatusChange, notifyUserBlocked } from '../websocket/handlers/friends';
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me_in_production";

interface FriendRequest {
  friendUsername: string;
}

interface FriendAction {
  friendId: number;
  action: 'accept' | 'reject' | 'block' | 'unfriend';
}

// Helper to get user from JWT
function getUserIdFromToken(request: FastifyRequest): number | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId;
  } catch {
    return null;
  }
}

export default async function friendRoutes(fastify: FastifyInstance) {
  // Get user's friends list
  fastify.get("/friends", async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    try {
      const friends = db.prepare(`
  SELECT 
    u.id,
    u.username,
    u.picture as avatarUrl,
    uf.status,
    uf.created_at as friendsSince,
    CASE 
      WHEN os.is_online = 1 THEN 'online'
      ELSE 'offline'
    END as onlineStatus
  FROM user_friends uf
  JOIN users u ON u.id = uf.friend_id
  LEFT JOIN user_online_status os ON os.user_id = u.id
  WHERE uf.user_id = ? AND uf.status = 'accepted'
  ORDER BY u.username
`).all(userId);

      return reply.send({ friends });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Get pending friend requests
  fastify.get("/friends/requests", async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    try {
      const requests = db.prepare(`
        SELECT 
          u.id,
          u.username,
          u.picture as avatarUrl,
          uf.created_at as requestedAt
        FROM user_friends uf
        JOIN users u ON u.id = uf.user_id
        WHERE uf.friend_id = ? AND uf.status = 'pending'
        ORDER BY uf.created_at DESC
      `).all(userId);

      return reply.send({ requests });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Get blocked users
  fastify.get("/friends/blocked", async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    try {
      const blocked = db.prepare(`
        SELECT 
          u.id,
          u.username,
          u.picture as avatarUrl,
          uf.created_at as blockedAt
        FROM user_friends uf
        JOIN users u ON u.id = uf.friend_id
        WHERE uf.user_id = ? AND uf.status = 'blocked'
        ORDER BY uf.created_at DESC
      `).all(userId);

      return reply.send({ blocked });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Get friend suggestions
  fastify.get("/friends/suggestions", async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    try {
      const currentUser = db.prepare("SELECT lives_in FROM users WHERE id = ?").get(userId) as any;

      const suggestions = db.prepare(`
        SELECT DISTINCT
          u.id,
          u.username,
          u.picture as avatarUrl,
          u.lives_in as location,
          (
            SELECT COUNT(DISTINCT uf2.friend_id)
            FROM user_friends uf1
            JOIN user_friends uf2 ON uf1.friend_id = uf2.friend_id
            WHERE uf1.user_id = ? 
            AND uf2.user_id = u.id
            AND uf1.status = 'accepted' 
            AND uf2.status = 'accepted'
          ) as mutualFriends
        FROM users u
        WHERE u.id != ?
        -- Not already friends or pending
        AND u.id NOT IN (
          SELECT friend_id FROM user_friends 
          WHERE user_id = ? AND status IN ('accepted', 'pending')
        )
        AND u.id NOT IN (
          SELECT user_id FROM user_friends 
          WHERE friend_id = ? AND status IN ('accepted', 'pending')
        )
        -- Not blocked (either direction)
        AND u.id NOT IN (
          SELECT friend_id FROM user_friends 
          WHERE user_id = ? AND status = 'blocked'
        )
        AND u.id NOT IN (
          SELECT user_id FROM user_friends 
          WHERE friend_id = ? AND status = 'blocked'
        )
        -- Has location match OR mutual friends
        AND (
          (u.lives_in = ? AND u.lives_in IS NOT NULL AND u.lives_in != '')
          OR EXISTS (
            SELECT 1 FROM user_friends uf1
            JOIN user_friends uf2 ON uf1.friend_id = uf2.friend_id
            WHERE uf1.user_id = ? AND uf2.user_id = u.id
            AND uf1.status = 'accepted' AND uf2.status = 'accepted'
          )
        )
        ORDER BY mutualFriends DESC, u.username
        LIMIT 10
      `).all(userId, userId, userId, userId, userId, userId, currentUser?.lives_in || '', userId);

      // Add reason for each suggestion
      const suggestionsWithReason = (suggestions as any[]).map((s: any) => ({
        ...s,
        reason: s.mutualFriends > 0
          ? `${s.mutualFriends} mutual friend${s.mutualFriends > 1 ? 's' : ''}`
          : `From ${s.location || 'your area'}`
      }));

      return reply.send({ suggestions: suggestionsWithReason });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Send friend request
  fastify.post<{ Body: FriendRequest }>("/friends/request", async (request, reply) => {
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const { friendUsername } = request.body;
    if (!friendUsername) {
      return reply.status(400).send({ error: "Friend username required" });
    }

    if (friendUsername === await getUsername(userId)) {
      return reply.status(400).send({ error: "Cannot add yourself as friend" });
    }

    try {
      // Find friend user
      const friend = db.prepare("SELECT id, username FROM users WHERE username = ?").get(friendUsername);

      if (!friend) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Check if friend request already exists
      const existingRequest = db.prepare(`
        SELECT * FROM user_friends 
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      `).get(userId, friend.id, friend.id, userId);

      if (existingRequest) {
        const status = existingRequest.status;
        if (status === 'pending') {
          return reply.status(400).send({ error: "Friend request already sent" });
        } else if (status === 'accepted') {
          return reply.status(400).send({ error: "Already friends" });
        } else if (status === 'blocked') {
          return reply.status(400).send({ error: "Cannot send request to blocked user" });
        }
      }

      // Create friend request
      db.prepare(`
        INSERT INTO user_friends (user_id, friend_id, status, created_at)
        VALUES (?, ?, 'pending', datetime('now'))
      `).run(userId, friend.id);

      // Notify friend via WebSocket
      handleFriendRequest(friend.id, userId);

      return reply.send({
        message: "Friend request sent",
        friend: { id: friend.id, username: friend.username }
      });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Accept/Reject/Block/Unfriend
  fastify.post<{ Body: FriendAction }>("/friends/action", async (request, reply) => {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const { friendId, action } = request.body;

    if (!friendId || !action) {
      return reply.status(400).send({ error: "Friend ID and action required" });
    }

    try {
      const friend = db.prepare("SELECT username FROM users WHERE id = ?").get(friendId);
      if (!friend) {
        return reply.status(404).send({ error: "User not found" });
      }

      let message: string;

      switch (action) {
        case 'accept':
          // Update both directions to accepted
          db.prepare(`
            UPDATE user_friends 
            SET status = 'accepted', updated_at = datetime('now')
            WHERE user_id = ? AND friend_id = ?
          `).run(friendId, userId);

          // Create reciprocal friendship
          const existingReciprocal = db.prepare(`
            SELECT * FROM user_friends WHERE user_id = ? AND friend_id = ?
          `).get(userId, friendId);

          if (!existingReciprocal) {
            db.prepare(`
              INSERT INTO user_friends (user_id, friend_id, status, created_at)
              VALUES (?, ?, 'accepted', datetime('now'))
            `).run(userId, friendId);
          } else {
            db.prepare(`
              UPDATE user_friends 
              SET status = 'accepted', updated_at = datetime('now')
              WHERE user_id = ? AND friend_id = ?
            `).run(userId, friendId);
          }

          message = "Friend request accepted";
          notifyFriendStatusChange(friendId, userId, 'accepted');
          break;

        case 'reject':
          db.prepare("DELETE FROM user_friends WHERE user_id = ? AND friend_id = ?").run(friendId, userId);
          message = "Friend request rejected";
          break;

        case 'block':
          // First, remove any existing friendship from both sides
          db.prepare("DELETE FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)")
            .run(userId, friendId, friendId, userId);
          
          // Then create block entry (one-way block)
          db.prepare(`
            INSERT INTO user_friends (user_id, friend_id, status, created_at)
            VALUES (?, ?, 'blocked', datetime('now'))
          `).run(userId, friendId);
          
          message = "User blocked";
          // Notify the other user that they've been unfriended (but not blocked)
          notifyFriendStatusChange(friendId, userId, 'unfriended');
          // Also notify them they've been blocked (for real-time UI updates like disabling game invites)
          notifyUserBlocked(friendId, userId);
          break;

        case 'unfriend':
          db.prepare("DELETE FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)")
            .run(userId, friendId, friendId, userId);
          message = "Friend removed";
          notifyFriendStatusChange(friendId, userId, 'unfriended');
          break;

        default:
          return reply.status(400).send({ error: "Invalid action" });
      }

      return reply.send({
        message,
        friend: { id: friendId, username: friend.username }
      });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Search users
  fastify.get("/users/search", async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const { q } = request.query as any;
    
    try {
      const users = db.prepare(`
  SELECT 
    u.id,
    u.username,
    u.picture as avatarUrl,
    u.created_at as memberSince,
    CASE 
      WHEN os.is_online = 1 THEN 'online'
      ELSE 'offline'
    END as onlineStatus,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM user_friends 
        WHERE user_id = ? AND friend_id = u.id AND status = 'accepted'
      ) THEN 'friend'
      WHEN EXISTS (
        SELECT 1 FROM user_friends 
        WHERE user_id = ? AND friend_id = u.id AND status = 'pending'
      ) THEN 'pending'
      WHEN EXISTS (
        SELECT 1 FROM user_friends 
        WHERE user_id = u.id AND friend_id = ? AND status = 'pending'
      ) THEN 'requested'
      ELSE 'none'
    END as relationship
  FROM users u
  LEFT JOIN user_online_status os ON os.user_id = u.id
  WHERE u.username LIKE ? 
    AND u.id != ? 
    AND u.deleted = 0
    -- Exclude users who have blocked the current user
    AND NOT EXISTS (
      SELECT 1 FROM user_friends 
      WHERE user_id = u.id AND friend_id = ? AND status = 'blocked'
    )
    -- Exclude users whom the current user has blocked
    AND NOT EXISTS (
      SELECT 1 FROM user_friends 
      WHERE user_id = ? AND friend_id = u.id AND status = 'blocked'
    )
  ORDER BY 
    CASE WHEN relationship = 'friend' THEN 1
         WHEN relationship = 'pending' THEN 2
         WHEN relationship = 'requested' THEN 3
         ELSE 4 END,
    u.username
  LIMIT 20
`).all(userId, userId, userId, `%${q}%`, userId, userId, userId);

      return reply.send({ users });
    } catch (error) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}

// Helper functions
async function getUsername(userId: number): Promise<string> {
  const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
  return user?.username || '';
}

function notifyFriendStatusChange(userId: number, friendId: number, status: string) {
  if (status === 'accepted' || status === 'unfriended') {
    handleFriendStatusChange(userId, friendId, status as any);
  }
}