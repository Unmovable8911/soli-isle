import type { AvailabilityProbe } from "@/services/health";

export const availableProbe: AvailabilityProbe = {
  async checkAvailability() {},
};

export const unavailableProbe: AvailabilityProbe = {
  async checkAvailability() {
    throw new Error("unavailable");
  },
};
