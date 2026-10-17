import { describe, expect, it } from "vitest";
import { resolveRuntimePaths } from "./runtime";

describe("runtime paths", () => {
  it("uses the site data directory defaults", () => {
    expect(resolveRuntimePaths({}, "/srv/soli-isle")).toEqual({
      databasePath: "/srv/soli-isle/data/database/soli-isle.sqlite",
      resourceDir: "/srv/soli-isle/data/images",
      migrationsDir: "/srv/soli-isle/drizzle",
    });
  });

  it("honours deployment configuration and in-memory databases", () => {
    expect(
      resolveRuntimePaths(
        {
          DATABASE_PATH: "storage/site.sqlite",
          RESOURCE_DIR: "/var/lib/soli-isle/images",
        },
        "/srv/soli-isle",
      ),
    ).toEqual({
      databasePath: "/srv/soli-isle/storage/site.sqlite",
      resourceDir: "/var/lib/soli-isle/images",
      migrationsDir: "/srv/soli-isle/drizzle",
    });

    expect(resolveRuntimePaths({ DATABASE_PATH: ":memory:" }, "/srv/soli-isle").databasePath).toBe(
      ":memory:",
    );
  });
});
