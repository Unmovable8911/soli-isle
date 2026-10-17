import type { ThrottleConfig } from "@/domain/throttle";

export const SESSION_COOKIE_NAME = "soli-session";
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export interface AuthorAuthConfig {
  passwordHash: string | null; // env AUTHOR_PASSWORD_HASH，trim 后空串视为 null
  totpSecret: string | null; // env AUTHOR_TOTP_SECRET，trim 后空串视为 null（TOTP 预留钩子，默认关闭）
  sessionTtlDays: number; // SESSION_TTL_DAYS
  throttle: ThrottleConfig; // 上面全部默认值
}

const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
  windowMs: 15 * 60_000,
  failureThreshold: 3,
  backoffBaseMs: 30_000,
  backoffCapMs: 30 * 60_000,
  globalWindowMs: 10 * 60_000,
  globalFailureThreshold: 20,
  globalBackoffBaseMs: 5 * 60_000,
  globalBackoffCapMs: 60 * 60_000,
};

export function resolveAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthorAuthConfig {
  return {
    passwordHash: readOptional(env.AUTHOR_PASSWORD_HASH),
    totpSecret: readOptional(env.AUTHOR_TOTP_SECRET),
    sessionTtlDays: SESSION_TTL_DAYS,
    throttle: { ...DEFAULT_THROTTLE_CONFIG },
  };
}

function readOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
