import { randomBytes } from "node:crypto";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;
const ENTROPY_BYTES = 10;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function encodeTime(timestampMs: number): string {
  let remaining = Math.max(0, Math.trunc(timestampMs));
  let encoded = "";
  for (let index = 0; index < TIME_LENGTH; index += 1) {
    encoded = CROCKFORD_ALPHABET[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  }
  return encoded;
}

function encodeEntropy(entropy: Uint8Array): string {
  let bits = 0n;
  for (const byte of entropy) {
    bits = (bits << 8n) | BigInt(byte);
  }
  let encoded = "";
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    encoded = CROCKFORD_ALPHABET[Number(bits & 31n)] + encoded;
    bits >>= 5n;
  }
  return encoded;
}

export function encodeUlid(timestampMs: number, entropy: Uint8Array): string {
  return encodeTime(timestampMs) + encodeEntropy(entropy);
}

export function generateUlid(now: Date): string {
  return encodeUlid(now.getTime(), randomBytes(ENTROPY_BYTES));
}

export function ulidTimestamp(value: string): number {
  let timestamp = 0;
  for (const character of value.slice(0, TIME_LENGTH)) {
    timestamp = timestamp * 32 + CROCKFORD_ALPHABET.indexOf(character);
  }
  return timestamp;
}

export function isUlid(value: unknown): value is string {
  return typeof value === "string" && ULID_PATTERN.test(value);
}
