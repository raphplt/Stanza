import { count, eq, inArray } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db/client";
import { post, reaction } from "@/db/schema";
import { formatShortFrenchDate } from "@/lib/dates";
import { requireUser } from "@/lib/permissions";
import { generateDefaultExcerpt } from "@/lib/render";
import { StudioList, type StudioPost } from "./studio-list";

export default function StudioPage() {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <StudioContent />
    </Suspense>
  );
}

async function StudioContent() {
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
  const reactionRows = liveIds.length
    ? await db
        .select({ postId: reaction.postId, total: count() })
        .from(reaction)
        .where(inArray(reaction.postId, liveIds))
        .groupBy(reaction.postId)
    : [];
  const reactions = new Map(reactionRows.map((r) => [r.postId, r.total]));

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
  }));

  const hasPublished = rows.some((r) => r.publishedAt);
  const checklist =
    user.checklistDismissed || (user.image && user.bio && hasPublished)
      ? null
      : { photo: Boolean(user.image), bio: Boolean(user.bio), published: hasPublished };

  return <StudioList posts={posts} username={user.username} checklist={checklist} />;
}

function StudioSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 rounded-lg bg-surface" />
        <div className="h-11 w-36 rounded-full bg-surface" />
      </div>
      <div className="mt-8 h-11 w-full max-w-md rounded-lg bg-surface/70" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface/60" />
        ))}
      </div>
    </div>
  );
}
