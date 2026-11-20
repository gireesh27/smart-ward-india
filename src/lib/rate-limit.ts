import { createHash } from "node:crypto";
import { prisma } from "./db";
import { AppError } from "./errors";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * multiple app instances. One atomic upsert per call.
 */
export async function rateLimit(bucket: string, identity: string, limit: number, windowSec: number): Promise<void> {
  const key = `${bucket}:${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
  const now = new Date();
  const reset = new Date(now.getTime() + windowSec * 1000);
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt") VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${reset} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (row && row.count > limit) {
    const retry = Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - now.getTime()) / 1000));
    throw new AppError(429, "RATE_LIMITED", `Too many requests. Try again in ${retry} seconds.`, { retryAfter: retry });
  }
}
