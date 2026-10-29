import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { post, user } from "@/db/schema";
import { formatShortFrenchDate } from "@/lib/dates";
import { requireSuperAdmin } from "@/lib/permissions";
import { PageTitle, TableSkeleton } from "../ui";
import { PostsTable } from "./posts-table";

export const metadata: Metadata = { title: "Textes" };

export default function AdminPostsPage({ searchParams }: PageProps<"/admin/textes">) {
  return (
    <>
      <PageTitle title="Textes" description="Textes publiés et non listés de tous les auteurs." />
      <Suspense fallback={<TableSkeleton />}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Posts({ searchParams }: Pick<PageProps<"/admin/textes">, "searchParams">) {
  await requireSuperAdmin();
  const { auteur } = await searchParams;
  const authorFilter = typeof auteur === "string" ? auteur : "";

  const live = and(inArray(post.status, ["published", "unlisted"]), isNull(post.deletedAt));
  const [authors, rows] = await Promise.all([
    db
      .selectDistinct({ username: user.username, name: user.name })
      .from(user)
      .innerJoin(post, and(eq(post.authorId, user.id), live))
      .orderBy(asc(user.name)),
    db
      .select({
        id: post.id,
        title: post.publishedTitle,
        slug: post.slug,
        shareId: post.shareId,
        status: post.status,
        publishedAt: post.publishedAt,
        author: user.name,
        username: user.username,
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .where(and(live, authorFilter ? eq(user.username, authorFilter) : undefined))
      .orderBy(desc(post.publishedAt))
      .limit(500),
  ]);

  return (
    <PostsTable
      key={authorFilter}
      authors={authors}
      authorFilter={authorFilter}
      posts={rows.map((r) => ({
        id: r.id,
        title: r.title || "Sans titre",
        href: r.status === "published" ? `/${r.username}/${r.slug}` : `/s/${r.shareId}`,
        status: r.status as "published" | "unlisted",
        author: r.author,
        date: r.publishedAt ? formatShortFrenchDate(r.publishedAt) : "",
      }))}
    />
  );
}
