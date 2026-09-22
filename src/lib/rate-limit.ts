import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { fail } from "./api";

let redisClient: Redis | null | undefined;

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("[CP] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled");
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimitKey(req: NextRequest, scope: string, identity?: string) {
  const ip = getClientIp(req);
  const who = identity || "anon";
  return `${scope}:${who}:${ip}`;
}

// In-memory fallback map when Redis is not configured or offline
const memoryLimitStore = new Map<string, { count: number; expiresAt: number }>();

function checkMemoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = memoryLimitStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
    const res = fail("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
    res.headers.set("Retry-After", String(retryAfterSec));
    return res;
  }

  return null;
}

export async function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const redis = getRedisClient();
  if (!redis) {
    return checkMemoryRateLimit(input.key, input.limit, input.windowMs);
  }

  try {
    const windowSec = Math.max(1, Math.ceil(input.windowMs / 1000));
    const key = `cp:rl:${input.key}`;
    const count = Number(await redis.incr(key));
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    if (count > input.limit) {
      let retryAfterSec = Number(await redis.ttl(key));
      if (!Number.isFinite(retryAfterSec) || retryAfterSec < 1) retryAfterSec = windowSec;
      const res = fail("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
      res.headers.set("Retry-After", String(retryAfterSec));
      return res;
    }
    return null;
  } catch (error) {
    console.error("[CP] rate-limit redis error, using memory fallback:", error);
    return checkMemoryRateLimit(input.key, input.limit, input.windowMs);
  }
}
