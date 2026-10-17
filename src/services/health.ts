export interface AvailabilityProbe {
  checkAvailability(): Promise<void>;
}

export interface HealthContext {
  database: AvailabilityProbe;
  storage: AvailabilityProbe;
}

export interface HealthReport {
  status: "ok" | "degraded";
  checks: {
    database: "ok" | "unavailable";
    storage: "ok" | "unavailable";
  };
}

async function probe(availability: AvailabilityProbe): Promise<"ok" | "unavailable"> {
  try {
    await availability.checkAvailability();
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function getHealth(context: HealthContext): Promise<HealthReport> {
  const [database, storage] = await Promise.all([
    probe(context.database),
    probe(context.storage),
  ]);

  return {
    status: database === "ok" && storage === "ok" ? "ok" : "degraded",
    checks: { database, storage },
  };
}
