import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    session: {
      setState: (state: string) => void;
      getState: () => string | null;
    };
  }
}