import { createApp } from './app.js';

async function main() {
  const app = await createApp();
  const { port, host } = app.config;
  await app.listen({ port, host });
  console.log(`Server running at http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
