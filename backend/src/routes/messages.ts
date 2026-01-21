import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../models';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me_in_production";

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

export default async function messagesRoutes(fastify: FastifyInstance) {
    // Get message history with a specific friend
    fastify.get('/:friendId', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { friendId } = request.params as any;
        const parsedFriendId = parseInt(friendId);

        if (isNaN(parsedFriendId)) {
            return reply.status(400).send({ error: 'Invalid friend ID' });
        }

        try {
            // Fetch all messages between the two users
            const messages = db.prepare(`
        SELECT 
          m.id,
          m.sender_id,
          m.receiver_id,
          m.content,
          m.created_at as timestamp,
          m.read_at,
          u.username as sender_username,
          u.picture as sender_avatar
        FROM chat_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
      `).all(userId, parsedFriendId, parsedFriendId, userId);

            // Format messages for frontend
            const formattedMessages = (messages as any[]).map((msg: any) => ({
                id: msg.id.toString(),
                sender: {
                    id: msg.sender_id,
                    username: msg.sender_username,
                    avatarUrl: msg.sender_avatar
                },
                content: msg.content,
                timestamp: msg.timestamp,
                type: 'private',
                isRead: !!msg.read_at
            }));

            return reply.send({ messages: formattedMessages });
        } catch (error) {
            return reply.status(500).send({ error: 'Failed to fetch messages' });
        }
    });

    // Get unread message counts for all friends
    fastify.get('/unread/counts', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        try {
            // Get unread counts and last message timestamp for each friend
            const unreadCounts = db.prepare(`
        SELECT 
          sender_id,
          COUNT(*) as count,
          MAX(created_at) as last_message_at
        FROM chat_messages
        WHERE receiver_id = ? AND read_at IS NULL
        GROUP BY sender_id
      `).all(userId);

            // Get last message timestamp for friends with no unread messages
            const allLastMessages = db.prepare(`
        SELECT 
          CASE 
            WHEN sender_id = ? THEN receiver_id
            ELSE sender_id
          END as friend_id,
          MAX(created_at) as last_message_at
        FROM chat_messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY friend_id
      `).all(userId, userId, userId);

            // Format as object with friendId as key
            const counts: { [key: string]: number } = {};
            const lastMessageTimes: { [key: string]: string } = {};

            (unreadCounts as any[]).forEach((row: any) => {
                counts[row.sender_id.toString()] = row.count;
                lastMessageTimes[row.sender_id.toString()] = row.last_message_at;
            });

            (allLastMessages as any[]).forEach((row: any) => {
                const friendId = row.friend_id.toString();
                if (!lastMessageTimes[friendId]) {
                    lastMessageTimes[friendId] = row.last_message_at;
                }
            });

            return reply.send({
                unreadCounts: counts,
                lastMessageTimes: lastMessageTimes
            });
        } catch (error) {
            return reply.status(500).send({ error: 'Failed to fetch unread counts' });
        }
    });

    // Mark messages as read
    fastify.post('/:friendId/read', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { friendId } = request.params as any;
        const parsedFriendId = parseInt(friendId);

        if (isNaN(parsedFriendId)) {
            return reply.status(400).send({ error: 'Invalid friend ID' });
        }

        try {
            // Mark all messages from this friend as read
            const result = db.prepare(`
        UPDATE chat_messages
        SET read_at = datetime('now')
        WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL
      `).run(userId, parsedFriendId);

            return reply.send({
                success: true,
                markedAsRead: result.changes
            });
        } catch (error) {
            return reply.status(500).send({ error: 'Failed to mark messages as read' });
        }
    });
}
