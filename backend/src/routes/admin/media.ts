import { FastifyPluginAsync } from 'fastify';
import { createWriteStream, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';

export const adminMediaRoutes: FastifyPluginAsync = async (app) => {
  const mediaDir = app.config.mediaDir;

  app.post('/api/admin/media', async (request, reply) => {
    if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const ext = extname(data.filename) || '.bin';
    const filename = `${crypto.randomUUID()}${ext}`;
    const dest = join(mediaDir, filename);

    await pipeline(data.file, createWriteStream(dest));

    return { url: `/media/${filename}` };
  });

  app.get('/api/admin/media', async () => {
    if (!existsSync(mediaDir)) return [];
    const files = readdirSync(mediaDir);
    return files.map(f => ({ filename: f, url: `/media/${f}` }));
  });

  app.delete('/api/admin/media/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    // Security: prevent path traversal
    if (filename.includes('/') || filename.includes('..')) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }
    const filepath = join(mediaDir, filename);
    if (!existsSync(filepath)) return reply.status(404).send({ error: 'Not found' });
    unlinkSync(filepath);
    return { ok: true };
  });
};
