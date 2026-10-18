import { describe, expect, it } from "vitest";
import { formatByteSize, formatUploadedAt, uploadFailureKey } from "./asset-display";

describe("formatByteSize", () => {
  it("prints whole bytes below one kibibyte", () => {
    expect(formatByteSize(1)).toBe("1 B");
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(1023)).toBe("1023 B");
  });

  it("switches unit exactly at each binary threshold", () => {
    expect(formatByteSize(1024)).toBe("1.0 KB");
    expect(formatByteSize(1024 * 1024 - 1)).toBe("1024.0 KB");
    expect(formatByteSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatByteSize(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("keeps one decimal place for scaled units", () => {
    expect(formatByteSize(1536)).toBe("1.5 KB");
    expect(formatByteSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatByteSize(2_621_440)).toBe("2.5 MB");
    expect(formatByteSize(3_221_225_472)).toBe("3.0 GB");
  });

  it("degrades to zero bytes for nonsensical input", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(-10)).toBe("0 B");
    expect(formatByteSize(Number.NaN)).toBe("0 B");
    expect(formatByteSize(Number.POSITIVE_INFINITY)).toBe("0 B");
  });
});

describe("formatUploadedAt", () => {
  it("renders an ISO instant in the site time zone for zh", () => {
    expect(formatUploadedAt("2024-03-05T16:30:00.000Z", "zh")).toBe("2024-03-06 00:30");
  });

  it("renders an ISO instant in the site time zone for en", () => {
    expect(formatUploadedAt("2024-03-05T16:30:00.000Z", "en")).toBe("03/06/2024, 00:30");
  });

  it("keeps midnight as 00 rather than 24", () => {
    expect(formatUploadedAt("2024-01-01T16:00:00.000Z", "zh")).toBe("2024-01-02 00:00");
  });

  it("returns an empty string for an unparsable instant", () => {
    expect(formatUploadedAt("not-a-date", "zh")).toBe("");
    expect(formatUploadedAt("", "en")).toBe("");
  });
});

describe("uploadFailureKey", () => {
  it("maps the documented upload statuses to readable keys", () => {
    expect(uploadFailureKey(415, "unsupported-type")).toBe("unsupportedType");
    expect(uploadFailureKey(413, "too-large")).toBe("tooLarge");
    expect(uploadFailureKey(422, "invalid-image")).toBe("invalidImage");
  });

  it("trusts the error code when the status is generic", () => {
    expect(uploadFailureKey(400, "too-large")).toBe("tooLarge");
    expect(uploadFailureKey(500, null)).toBe("failed");
  });

  it("falls back for unknown failures", () => {
    expect(uploadFailureKey(401, "unauthorized")).toBe("failed");
    expect(uploadFailureKey(0, null)).toBe("failed");
  });
});
