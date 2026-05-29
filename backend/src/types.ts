import { createDb } from './db/index.js';
import { readConfig } from './config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>;
    config: ReturnType<typeof readConfig>;
  }
  interface FastifyRequest {
    isAuthenticated: () => boolean;
  }
}
