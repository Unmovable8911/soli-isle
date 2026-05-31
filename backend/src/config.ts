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
    mediaDir: process.env.MEDIA_DIR || './data/media',
  };
}
