import fs from "node:fs";
import path from "node:path";
import { parseEnvFile, upsertEnvValue } from "../src/config/env-file";
import { resolveAuthConfig } from "../src/config/auth";
import { resolveRuntimePaths } from "../src/config/runtime";
import { openDatabase } from "../src/db/database";
import { runMigrations } from "../src/db/migrate";
import { systemClock } from "../src/domain/clock";
import { readNewPassword } from "./read-password";
import { hashPassword } from "../src/security/password-hash";
import {
  clearLoginFailures,
  createAuthorAuthContext,
  revokeAllAuthorSessions,
} from "../src/services/auth";

const ENV_KEY = "AUTHOR_PASSWORD_HASH";

function writeEnvFile(envPath: string, content: string): void {
  const directory = path.dirname(envPath);
  const temporaryPath = path.join(directory, `.env.${process.pid}.${Date.now()}.tmp`);
  const existingMode = fs.existsSync(envPath) ? fs.statSync(envPath).mode : 0o600;

  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode: existingMode });
    fs.renameSync(temporaryPath, envPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

async function main(): Promise<void> {
  const password = await readNewPassword();

  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env");
  const originalContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const hash = await hashPassword(password);
  writeEnvFile(envPath, upsertEnvValue(originalContent, ENV_KEY, hash));

  const mergedEnv = { ...parseEnvFile(originalContent), ...process.env };
  const { databasePath, migrationsDir } = resolveRuntimePaths(mergedEnv, cwd);

  let database: ReturnType<typeof openDatabase> | undefined;
  try {
    database = openDatabase(databasePath);
    runMigrations(database.db, migrationsDir);

    const context = createAuthorAuthContext(database, systemClock, resolveAuthConfig(mergedEnv));

    const revoked = revokeAllAuthorSessions(context);
    const cleared = clearLoginFailures(context);
    process.stdout.write(
      `Password hash written to .env. Revoked ${revoked} sessions, cleared ${cleared} failed-login records.\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Password hash was written to .env, but sessions were not revoked: ${message}\n`,
    );
    process.exitCode = 1;
  } finally {
    database?.sqlite.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Password reset failed: ${message}\n`);
  process.exit(1);
});
