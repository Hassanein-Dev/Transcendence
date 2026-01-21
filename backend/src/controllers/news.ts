import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import db from "../models";

export default async function newsRoutes(fastify: FastifyInstance) {

    // Public Endpoint: Get all news (limit 20)
    fastify.get("/news", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const news = db.prepare(`
        SELECT * FROM news 
        ORDER BY 
          CASE WHEN type = 'event' AND event_date IS NOT NULL 
               THEN event_date 
               ELSE created_at 
          END DESC 
        LIMIT 20
      `).all();
            return news;
        } catch (error) {
            return reply.status(500).send({ error: "Failed to fetch news" });
        }
    });

    // Admin Endpoint: Create News/Event
    fastify.post<{ Body: { title: string, content: string, type: 'news' | 'event' | 'update' | 'tournament' | 'feature' | 'maintenance', event_date?: string } }>(
        "/news",
        async (request, reply) => {
            // Check auth (assuming request.user is populated by auth hook)

            const { title, content, type, event_date } = request.body;

            if (!title || !content || !type) {
                return reply.status(400).send({ error: "Missing required fields" });
            }

            // Validate Type
            const validTypes = ['news', 'event', 'update', 'tournament', 'feature', 'maintenance'];
            if (!validTypes.includes(type)) {
                return reply.status(400).send({ error: "Invalid news type" });
            }

            // Validate Event Date (future only)
            if (['event', 'tournament'].includes(type) && event_date) {
                const inputDate = new Date(event_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Start of today

                if (inputDate < today) {
                    return reply.status(400).send({ error: "Date cannot be in the past" });
                }
            } else if (['event', 'tournament'].includes(type) && !event_date) {
                return reply.status(400).send({ error: "Date is required for events and tournaments" });
            }

            try {
                const result = db.prepare(`
          INSERT INTO news (title, content, type, event_date, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(title, content, type, event_date || null);

                return { success: true, id: result.lastInsertRowid };
            } catch (error) {
                return reply.status(500).send({ error: "Failed to create news" });
            }
        }
    );

    // Admin Endpoint: Delete News
    fastify.delete<{ Params: { id: string } }>(
        "/news/:id",
        async (request, reply) => {
            const { id } = request.params;

            try {
                db.prepare("DELETE FROM news WHERE id = ?").run(id);
                return { success: true };
            } catch (error) {
                return reply.status(500).send({ error: "Failed to delete news" });
            }
        }
    );
}
