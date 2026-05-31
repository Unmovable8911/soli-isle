import { FastifyPluginAsync } from 'fastify';
import { verifyPassword } from '../../lib/password.js';

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/admin/login', async (request, reply) => {
    const { password } = request.body as { password: string };
    if (!password) {
      return reply.status(400).send({ error: 'Password is required' });
    }
    const valid = await verifyPassword(password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }
    request.session.set('authenticated', true);
    await request.session.save();
    return { ok: true };
  });

  app.post('/api/admin/logout', async (request) => {
    await request.session.destroy();
    return { ok: true };
  });

  app.get('/api/admin/me', async (request) => {
    return { authenticated: request.isAuthenticated() };
  });
};
