import { FastifyPluginAsync } from 'fastify';
import { verifyPassword } from '../../lib/password.js';

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/admin/login', async (request, reply) => {
    const { password, rememberMe } = request.body as { password: string; rememberMe?: boolean };
    if (!password) {
      return reply.status(400).send({ error: 'Password is required' });
    }
    const valid = await verifyPassword(password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }
    request.session.set('authenticated', true);
    // "Keep me logged in" extends this session's cookie lifetime; originalMaxAge is
    // persisted in the store, so rolling refreshes keep honoring the 7-day window.
    if (rememberMe) {
      request.session.cookie.maxAge = app.config.sessionRememberMaxAge;
    }
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
