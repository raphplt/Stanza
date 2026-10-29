"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { reaction } from "@/db/schema";
import { sha256Hex } from "@/lib/id";
import { isReadOnlyMode } from "@/lib/permissions";
import { consumeRateLimit, getClientIpHash } from "@/lib/rate-limit";
import { REACTION_KINDS, type ReactionState, VISITOR_COOKIE } from "@/lib/reactions";
import { canReactTo, getReactionState } from "@/lib/reactions-server";

const schema = z.object({ postId: z.uuid(), kind: z.enum(REACTION_KINDS) });

export async function toggleReactionAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; state: ReactionState } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Réaction invalide." };
  const { postId, kind } = parsed.data;

  if (await isReadOnlyMode()) return { ok: false, error: "Le site est en lecture seule." };
  if (!(await canReactTo(postId))) return { ok: false, error: "Les réactions sont désactivées." };

  const limit = await consumeRateLimit(`reaction:${await getClientIpHash()}`, 30, 60);
  if (!limit.allowed) return { ok: false, error: "Trop de réactions, réessayez dans un instant." };

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!visitorId || !z.uuid().safeParse(visitorId).success) {
    visitorId = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }
  const visitorHash = sha256Hex(`visitor:${visitorId}`);

  const removed = await db
    .delete(reaction)
    .where(and(eq(reaction.postId, postId), eq(reaction.kind, kind), eq(reaction.visitorHash, visitorHash)))
    .returning({ kind: reaction.kind });
  if (removed.length === 0) {
    await db.insert(reaction).values({ postId, kind, visitorHash }).onConflictDoNothing();
  }

  return { ok: true, state: await getReactionState(postId, visitorHash) };
}
