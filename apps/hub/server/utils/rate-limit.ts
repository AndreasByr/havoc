import { getRequestIP, createError, type H3Event } from "h3";

export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type WindowEntry = {
  timestamps: number[];
  resetAt: number;
};

const store = new Map<string, WindowEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function getRateLimitKey(event: H3Event, prefix: string): string {
  const config = typeof useRuntimeConfig === "function" ? useRuntimeConfig() : null;
  const ip = getRequestIP(event, { xForwardedFor: !!config?.trustProxy }) ?? "unknown";
  return `${prefix}:${ip}`;
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): { remaining: number; resetAt: number } {
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { timestamps: [], resetAt: now + opts.windowMs };
    store.set(key, entry);
  }

  // Lazy cleanup: drop timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= opts.max) {
    const oldestInWindow = entry.timestamps[0]!;
    const retryAfterMs = oldestInWindow + opts.windowMs - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    throw createError({
      statusCode: 429,
      statusMessage: "Too Many Requests",
      data: { retryAfter: retryAfterSec },
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  entry.timestamps.push(now);
  const remaining = opts.max - entry.timestamps.length;

  return { remaining, resetAt: entry.resetAt };
}
