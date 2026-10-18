import path from "node:path";

import { resolveRuntimePaths } from "../src/config/runtime";
import { createAppContext } from "../src/server/app-context";
import { assertLocalSeed, parseSeedArguments, seedDemo } from "../src/server/demo-seed";

/**
 * npm run seed:demo — the local walkthrough site.
 *
 * Relative imports on purpose: scripts run under tsx, which resolves the `@/`
 * alias too, but a script that can only be read with a bundler's config in hand
 * is a script nobody debugs twice.
 */
async function main(): Promise<void> {
  assertLocalSeed(process.env);
  const { imagesDir } = parseSeedArguments(process.argv.slice(2));
  const paths = resolveRuntimePaths(process.env, process.cwd());
  const context = createAppContext();

  try {
    const summary = await seedDemo({
      ...context,
      resourceDir: paths.resourceDir,
      imagesDir: imagesDir === null ? null : path.resolve(imagesDir),
    });
    console.log(
      `seed:demo wrote ${summary.articles} Articles, ${summary.posts} Posts and ${summary.images} images`,
    );
    console.log(`  database  ${paths.databasePath}`);
    console.log(`  images    ${paths.resourceDir}`);
  } finally {
    context.database.sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
