export function readConfig() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required');
  }
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    dbPath: process.env.DB_PATH || './data/soli-isle.db',
    adminPassword,
    sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production-secret!!',
    // Session cookie lifetime in milliseconds (@fastify/session expects ms, not seconds).
    // With rolling sessions (the library default), this acts as an inactivity timeout.
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || String(1000 * 60 * 30), 10),
    // Lifetime applied when the user ticks "keep me logged in" at login (default 7 days).
    sessionRememberMaxAge: parseInt(process.env.SESSION_REMEMBER_MAX_AGE || String(1000 * 60 * 60 * 24 * 7), 10),
    mediaDir: process.env.MEDIA_DIR || './data/media',
  };
}
