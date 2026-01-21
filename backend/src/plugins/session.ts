import { FastifyPluginCallback } from 'fastify';
import { FastifyRequest } from 'fastify';

// Simple in-memory session storage for OAuth state
const sessionStore = new Map<string, { state: string; createdAt: number }>();

// Clean up old sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessionStore.entries()) {
    if (now - session.createdAt > 3600000) { // 1 hour
      sessionStore.delete(key);
    }
  }
}, 3600000);

const sessionPlugin: FastifyPluginCallback = (fastify, options, done) => {
  // Add session property to request
  fastify.decorateRequest('session', null);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Create a simple session ID from IP and User-Agent
    const sessionId = request.ip + (request.headers['user-agent'] || '');
    
    (request as any).session = {
      setState(state: string) {
        sessionStore.set(sessionId, { state, createdAt: Date.now() });
      },
      getState() {
        const session = sessionStore.get(sessionId);
        return session?.state || null;
      }
    };
  });

  done();
};

export default sessionPlugin;