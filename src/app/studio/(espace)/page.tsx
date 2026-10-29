import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { post, postView, reaction } from "@/db/schema";
import { formatShortFrenchDate } from "@/lib/dates";
import { requireUser } from "@/lib/permissions";
import { generateDefaultExcerpt } from "@/lib/render";
import { StudioList, type StudioPost } from "./studio-list";

export const instant = false;

export default async function StudioPage() {
  const { user } = await requireUser();
  const rows = await db.query.post.findMany({
    where: eq(post.authorId, user.id),
    columns: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      status: true,
      slug: true,
      shareId: true,
      hasUnpublishedChanges: true,
      pinnedAt: true,
      publishedAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  const liveIds = rows.filter((r) => r.status !== "draft").map((r) => r.id);
  const [reactionRows, viewRows] = liveIds.length
    ? await Promise.all([
        db
          .select({ postId: reaction.postId, total: count() })
          .from(reaction)
          .where(inArray(reaction.postId, liveIds))
          .groupBy(reaction.postId),
        db
          .select({ postId: postView.postId, total: count() })
          .from(postView)
          .where(inArray(postView.postId, liveIds))
          .groupBy(postView.postId),
      ])
    : [[], []];
  const reactions = new Map(reactionRows.map((r) => [r.postId, r.total]));
  const views = new Map(viewRows.map((r) => [r.postId, r.total]));

  const posts: StudioPost[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.excerpt || generateDefaultExcerpt(r.content),
    status: r.status,
    slug: r.slug,
    shareId: r.shareId,
    hasUnpublishedChanges: r.hasUnpublishedChanges,
    pinned: Boolean(r.pinnedAt),
    trashed: Boolean(r.deletedAt),
    updatedAt: r.updatedAt.toISOString(),
    dateLabel: formatShortFrenchDate(r.updatedAt),
    reactions: reactions.get(r.id) ?? 0,
    views: views.get(r.id) ?? 0,
  }));

  const hasPublished = rows.some((r) => r.publishedAt);
  const checklist =
    user.checklistDismissed || (user.image && user.bio && hasPublished)
      ? null
      : { photo: Boolean(user.image), bio: Boolean(user.bio), published: hasPublished };

  return <StudioList posts={posts} username={user.username} checklist={checklist} />;
}
