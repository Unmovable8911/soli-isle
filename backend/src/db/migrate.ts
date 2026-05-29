import { runMigrations } from './index.js';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const dbPath = resolve(dataDir, 'soli-isle.db');
runMigrations(dbPath);
console.log(`Migrations applied to ${dbPath}`);
