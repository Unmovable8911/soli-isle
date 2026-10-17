import { describe, expect, it } from "vitest";
import { availableProbe, unavailableProbe } from "@/test/availability-probes";
import { getHealth } from "./health";

describe("health service", () => {
  it("reports healthy only when database and storage are both available", async () => {
    await expect(
      getHealth({ database: availableProbe, storage: availableProbe }),
    ).resolves.toEqual({
      status: "ok",
      checks: { database: "ok", storage: "ok" },
    });
  });

  it("reports a degraded service when the database is unavailable", async () => {
    await expect(
      getHealth({ database: unavailableProbe, storage: availableProbe }),
    ).resolves.toEqual({
      status: "degraded",
      checks: { database: "unavailable", storage: "ok" },
    });
  });

  it("reports a degraded service when resource storage is unavailable", async () => {
    await expect(
      getHealth({ database: availableProbe, storage: unavailableProbe }),
    ).resolves.toEqual({
      status: "degraded",
      checks: { database: "ok", storage: "unavailable" },
    });
  });
});
