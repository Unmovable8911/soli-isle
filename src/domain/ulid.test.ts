import { describe, expect, it } from "vitest";

import { encodeUlid, generateUlid, isUlid, ulidTimestamp } from "./ulid";

const ZERO_ENTROPY = new Uint8Array(10);

/** The ULID specification's worked example: 01ARYZ6S41TSV4RRFFQ69G5FAV. */
const SPEC_ENTROPY = Uint8Array.from([214, 118, 76, 97, 239, 185, 147, 2, 189, 91]);

describe("ulid", () => {
  it("encodes the timestamp of the ULID specification example", () => {
    expect(encodeUlid(1469918176385, ZERO_ENTROPY)).toBe("01ARYZ6S410000000000000000");
  });

  it("encodes the randomness of the ULID specification example", () => {
    expect(encodeUlid(1469918176385, SPEC_ENTROPY)).toBe("01ARYZ6S41TSV4RRFFQ69G5FAV");
  });

  it("reports the instant a ULID was created at", () => {
    expect(ulidTimestamp("01ARYZ6S41TSV4RRFFQ69G5FAV")).toBe(1469918176385);
  });

  it("generates a 26 character identifier from the clock", () => {
    const id = generateUlid(new Date("2025-06-15T08:30:00.000Z"));

    expect(id).toHaveLength(26);
    expect(isUlid(id)).toBe(true);
    expect(ulidTimestamp(id)).toBe(Date.parse("2025-06-15T08:30:00.000Z"));
  });

  it("generates distinct identifiers for the same instant", () => {
    const instant = new Date("2025-06-15T08:30:00.000Z");
    const ids = new Set(Array.from({ length: 64 }, () => generateUlid(instant)));

    expect(ids.size).toBe(64);
  });

  it("sorts lexicographically in creation order", () => {
    const earlier = encodeUlid(1469918176385, ZERO_ENTROPY);
    const later = encodeUlid(1469918176386, ZERO_ENTROPY);

    expect(earlier < later).toBe(true);
  });

  it("rejects values that are not ULIDs", () => {
    for (const value of [
      "",
      "01ARYZ6S41",
      "01ARYZ6S41TSV4RRFFQ69G5FAU",
      "01aryz6s41tsv4rrffq69g5fav",
      "01ARYZ6S41TSV4RRFFQ69G5FAVX",
      null,
      undefined,
      42,
    ]) {
      expect(isUlid(value)).toBe(false);
    }
  });
});
