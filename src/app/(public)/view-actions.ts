"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { post, postView } from "@/db/schema";
import { sha256Hex } from "@/lib/id";
import { getOptionalSession } from "@/lib/permissions";
import { getClientIpHash } from "@/lib/rate-limit";

const schema = z.object({ postId: z.uuid() });

export async function recordPostViewAction(input: { postId: string }): Promise<{ ok: boolean }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { postId } = parsed.data;

  const row = await db.query.post.findFirst({
    where: eq(post.id, postId),
    columns: { id: true, authorId: true, status: true, deletedAt: true },
  });
  if (!row || row.status === "draft" || row.deletedAt) return { ok: false };

  const session = await getOptionalSession();
  if (session?.user.id === row.authorId) {
    return { ok: true };
  }

  const ipHash = await getClientIpHash();
  const reqHeaders = await headers();
  const ua = reqHeaders.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = sha256Hex(`${ipHash}:${ua}:${day}`);

  await db.insert(postView).values({ postId, day, visitorHash }).onConflictDoNothing();

  return { ok: true };
}
