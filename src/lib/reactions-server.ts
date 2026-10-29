import { and, count, eq, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { post, reaction, user } from "@/db/schema";
import { sha256Hex } from "@/lib/id";
import { emptyCounts, type ReactionState, VISITOR_COOKIE } from "@/lib/reactions";

export async function getVisitorHash() {
  const id = (await cookies()).get(VISITOR_COOKIE)?.value;
  return id ? sha256Hex(`visitor:${id}`) : null;
}

export async function getReactionState(postId: string, visitorHash: string | null): Promise<ReactionState> {
  const [rows, mine] = await Promise.all([
    db
      .select({ kind: reaction.kind, total: count() })
      .from(reaction)
      .where(eq(reaction.postId, postId))
      .groupBy(reaction.kind),
    visitorHash
      ? db
          .select({ kind: reaction.kind })
          .from(reaction)
          .where(and(eq(reaction.postId, postId), eq(reaction.visitorHash, visitorHash)))
      : [],
  ]);
  const counts = emptyCounts();
  for (const r of rows) if (r.kind in counts) counts[r.kind] = r.total;
  return { counts, mine: mine.map((m) => m.kind) };
}

export async function canReactTo(postId: string) {
  const [row] = await db
    .select({ id: post.id })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(
      and(
        eq(post.id, postId),
        ne(post.status, "draft"),
        isNull(post.deletedAt),
        eq(user.reactionsEnabled, true),
        eq(user.banned, false),
        eq(user.status, "active"),
        isNull(user.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}
