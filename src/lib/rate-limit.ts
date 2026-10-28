import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { rateLimit } from "@/db/schema";
import { sha256Hex, uuidv7 } from "@/lib/id";

export async function getClientIpHash(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = h.get("x-real-ip")?.trim();
    const ip = forwarded || realIp || "127.0.0.1";
    return sha256Hex(`ip:${ip}`);
  } catch {
    return sha256Hex("ip:127.0.0.1");
  }
}

export async function consumeRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = await db.query.rateLimit.findFirst({
    where: eq(rateLimit.key, key),
  });

  if (!existing) {
    await db
      .insert(rateLimit)
      .values({
        id: uuidv7(),
        key,
        count: 1,
        lastRequest: now,
      })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: { count: 1, lastRequest: now },
      });
    return { allowed: true, retryAfter: 0 };
  }

  const elapsed = now - existing.lastRequest;
  if (elapsed >= windowMs) {
    await db.update(rateLimit).set({ count: 1, lastRequest: now }).where(eq(rateLimit.id, existing.id));
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= max) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    return { allowed: false, retryAfter };
  }

  await db
    .update(rateLimit)
    .set({ count: existing.count + 1 })
    .where(eq(rateLimit.id, existing.id));

  return { allowed: true, retryAfter: 0 };
}
