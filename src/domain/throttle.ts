export interface ThrottleConfig {
  windowMs: number; // 默认 15 分钟
  failureThreshold: number; // 默认 3
  backoffBaseMs: number; // 默认 30 秒
  backoffCapMs: number; // 默认 30 分钟
  globalWindowMs: number; // 默认 10 分钟
  globalFailureThreshold: number; // 默认 20
  globalBackoffBaseMs: number; // 默认 5 分钟
  globalBackoffCapMs: number; // 默认 60 分钟
}

export function loginRetryDelay(
  failureTimes: readonly Date[],
  now: Date,
  windowMs: number,
  failureThreshold: number,
  backoffBaseMs: number,
  backoffCapMs: number,
): number | null {
  const nowMs = now.getTime();
  const windowStartMs = nowMs - windowMs;
  const recent = failureTimes.filter(
    (time) => time.getTime() > windowStartMs && time.getTime() <= nowMs,
  );

  if (recent.length < failureThreshold) {
    return null;
  }

  const mostRecentMs = Math.max(...recent.map((time) => time.getTime()));
  const backoffMs = Math.min(
    backoffBaseMs * 2 ** (recent.length - failureThreshold),
    backoffCapMs,
  );
  return Math.max(0, mostRecentMs + backoffMs - nowMs);
}
