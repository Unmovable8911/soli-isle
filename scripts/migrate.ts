import { createAppContext } from "../src/server/app-context";

try {
  const context = createAppContext();
  context.database.sqlite.close();
} catch (error) {
  console.error("Database migration failed", error);
  process.exitCode = 1;
}
