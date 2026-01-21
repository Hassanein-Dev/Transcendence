import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import db from "../models";

interface AnonymizeUserBody {
  userId: number;
}

interface DeleteAccountBody {
  userId: number;
  confirmation: string;
}

export default async function gdprRoutes(fastify: FastifyInstance) {
  // Anonymize user data
  fastify.post<{ Body: AnonymizeUserBody }>(
    "/gdpr/anonymize",
    async (request, reply) => {
      const { userId } = request.body;

      try {
        // Anonymize user data while keeping game records for stats
        db.prepare(`
          UPDATE users SET 
            username = ?,
            email = NULL,
            picture = NULL,
            fullname = NULL,
            bio = NULL,
            birthday = NULL,
            lives_in = NULL,
            from_place = NULL,
            gender = NULL,
            education = NULL,
            phone = NULL,
            cover_photo = NULL,
            github_id = NULL,
            anonymized = 1,
            anonymized_at = datetime('now')
          WHERE id = ?
        `).run(`user_${userId}`, userId);

        // Remove personal messages
        db.prepare(`
          DELETE FROM chat_messages 
          WHERE sender_id = ? OR receiver_id = ?
        `).run(userId, userId);

        // Remove friend relationships
        db.prepare(`
          DELETE FROM user_friends 
          WHERE user_id = ? OR friend_id = ?
        `).run(userId, userId);

        return reply.send({
          success: true,
          message: "User data anonymized successfully"
        });
      } catch (error) {
        return reply.status(500).send({ error: "Failed to anonymize user data" });
      }
    }
  );

  // Delete user account and all data
  fastify.post<{ Body: DeleteAccountBody }>(
    "/gdpr/delete-account",
    async (request, reply) => {
      const { userId, confirmation } = request.body;

      if (confirmation !== "DELETE_MY_ACCOUNT") {
        return reply.status(400).send({
          error: "Confirmation phrase is required"
        });
      }

      // Check if user is admin
      const userToDelete = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
      if (userToDelete && userToDelete.username === 'admin') {
        return reply.status(403).send({ error: 'Admin account cannot be deleted' });
      }

      try {
        // Start transaction
        db.prepare("BEGIN TRANSACTION").run();

        // Delete user data in order (child tables first to avoid FK constraints)
        // Gaming related
        db.prepare("DELETE FROM tournament_players WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM tournament_matches WHERE player1_id = ? OR player2_id = ?").run(userId, userId);
        db.prepare("DELETE FROM games WHERE player1_id = ? OR player2_id = ?").run(userId, userId);
        db.prepare("DELETE FROM user_stats WHERE user_id = ?").run(userId);

        // Social related
        db.prepare("DELETE FROM chat_messages WHERE sender_id = ? OR receiver_id = ?").run(userId, userId);
        db.prepare("DELETE FROM user_friends WHERE user_id = ? OR friend_id = ?").run(userId, userId);
        db.prepare("DELETE FROM posts WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM photos WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM post_likes WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM post_comments WHERE user_id = ?").run(userId);

        // Auth/Security related
        db.prepare("DELETE FROM user_online_status WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM user_2fa WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM user_2fa_temp WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);

        // Finally delete the user
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);

        // Commit transaction
        db.prepare("COMMIT").run();

        return reply.send({
          success: true,
          message: "Account and all data deleted successfully"
        });
      } catch (error) {
        try {
          db.prepare("ROLLBACK").run();
        } catch (rollbackError) {
        }
        return reply.status(500).send({
          error: "Failed to delete account",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  // Export user data
  fastify.get("/gdpr/export-data/:userId", async (request: FastifyRequest<{ Params: { userId: string } }>, reply) => {
    const userId = parseInt(request.params.userId);

    try {
      const userData = {
        profile: db.prepare("SELECT * FROM users WHERE id = ?").get(userId),
        friends: db.prepare("SELECT * FROM user_friends WHERE user_id = ?").all(userId),
        gameHistory: db.prepare(`
          SELECT * FROM games 
          WHERE player1_id = ? OR player2_id = ?
          ORDER BY created_at DESC
        `).all(userId, userId),
        messages: db.prepare(`
          SELECT * FROM chat_messages 
          WHERE sender_id = ? OR receiver_id = ?
          ORDER BY created_at DESC
        `).all(userId, userId),
        tournamentHistory: db.prepare(`
          SELECT t.*, tp.joined_at 
          FROM tournaments t
          JOIN tournament_players tp ON t.id = tp.tournament_id
          WHERE tp.user_id = ?
        `).all(userId)
      };

      return reply.send(userData);
    } catch (error) {
      return reply.status(500).send({ error: "Failed to export user data" });
    }
  });
}