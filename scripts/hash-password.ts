import { hashPassword } from "../src/security/password-hash";
import { readNewPassword } from "./read-password";

async function main(): Promise<void> {
  const password = await readNewPassword();

  const hash = await hashPassword(password);
  process.stdout.write(`${hash}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Password hashing failed: ${message}\n`);
  process.exit(1);
});
