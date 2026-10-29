import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import type { PostCardData } from "@/components/reader/post-card";
import { db } from "@/db/client";
import { post, redirectTable, siteSettings, user } from "@/db/schema";
import {
  authorTag,
  authorUsernameTag,
  LANDING_TAG,
  postShareTag,
  postTag,
  REDIRECTS_TAG,
  SETTINGS_TAG,
  SITEMAP_TAG,
} from "@/lib/cache-tags";
import { formatFrenchDate } from "@/lib/dates";

export const PAGE_SIZE = 20;

export const SORTS = ["recents", "anciens", "a-z", "z-a"] as const;
export type PostSort = (typeof SORTS)[number];

export function parseSort(value: unknown): PostSort {
  return SORTS.includes(value as PostSort) ? (value as PostSort) : "recents";
}

const visibleAuthor = and(eq(user.banned, false), eq(user.status, "active"), isNull(user.deletedAt));
const livePost = (status: "published" | "unlisted") => and(eq(post.status, status), isNull(post.deletedAt));

const authorColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
  bio: user.bio,
  links: user.links,
  reactionsEnabled: user.reactionsEnabled,
};

const cardColumns = {
  id: post.id,
  slug: post.slug,
  title: post.publishedTitle,
  excerpt: post.publishedExcerpt,
  readingMinutes: post.readingMinutes,
  thumbnailUrl: post.firstImageUrl,
  publishedAt: post.publishedAt,
};

const articleColumns = {
  ...cardColumns,
  authorId: post.authorId,
  shareId: post.shareId,
  html: post.publishedHtml,
  ogImageUrl: post.ogImageUrl,
  lastPublishedAt: post.lastPublishedAt,
};

export type PostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  thumbnailUrl: string | null;
  publishedAt: Date;
};

function toCard<T extends { title: string | null; excerpt: string | null; publishedAt: Date | null }>(
  row: T,
): Omit<T, "title" | "excerpt" | "publishedAt"> & Pick<PostCard, "title" | "excerpt" | "publishedAt"> {
  return {
    ...row,
    title: row.title ?? "",
    excerpt: row.excerpt ?? "",
    publishedAt: row.publishedAt ?? new Date(0),
  };
}

async function findVisibleAuthor(username: string) {
  const [author] = await db
    .select(authorColumns)
    .from(user)
    .where(and(eq(sql`lower(${user.username})`, username.toLowerCase()), visibleAuthor))
    .limit(1);
  return author ?? null;
}

export async function getSiteSettings() {
  "use cache";
  cacheLife("max");
  cacheTag(SETTINGS_TAG);
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  return (
    row ?? {
      siteName: "Stanza",
      tagline: "Des textes, rien que des textes.",
      landingText: "",
      accessRequestsOpen: true,
      showLatestPostsOnLanding: false,
      readOnlyMode: false,
      legalNotice: "",
    }
  );
}

export async function getRedirect(path: string) {
  "use cache";
  cacheLife("max");
  cacheTag(REDIRECTS_TAG);
  const [row] = await db
    .select({ toPath: redirectTable.toPath })
    .from(redirectTable)
    .where(eq(redirectTable.fromPath, path))
    .limit(1);
  return row?.toPath ?? null;
}

export async function getPublicProfile(username: string) {
  "use cache";
  cacheLife("max");
  cacheTag(authorUsernameTag(username));
  const author = await findVisibleAuthor(username);
  if (!author) return null;
  cacheTag(authorTag(author.id));

  const [[{ total }], pinned] = await Promise.all([
    db
      .select({ total: count() })
      .from(post)
      .where(and(eq(post.authorId, author.id), livePost("published"))),
    db
      .select(cardColumns)
      .from(post)
      .where(and(eq(post.authorId, author.id), livePost("published"), isNotNull(post.pinnedAt)))
      .orderBy(asc(post.pinnedAt)),
  ]);

  return { author, total, pinned: pinned.map(toCard) };
}

const cursorSchema = z.object({ v: z.string(), id: z.string() });

function encodeCursor(value: string, id: string) {
  return Buffer.from(JSON.stringify({ v: value, id })).toString("base64url");
}

function decodeCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
  } catch {
    return null;
  }
}

async function queryAuthorPosts(authorId: string, query: string, sort: PostSort, cursor: string | null) {
  const titleKey = sql<string>`lower(unaccent(coalesce(${post.publishedTitle}, '')))`;
  const byTitle = sort === "a-z" || sort === "z-a";
  const descending = sort === "recents" || sort === "z-a";
  const key = byTitle ? titleKey : post.publishedAt;
  const after = decodeCursor(cursor);

  const conditions = [eq(post.authorId, authorId), livePost("published")];
  if (query) {
    const pattern = `%${query.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      sql`unaccent(lower(coalesce(${post.publishedTitle}, '') || ' ' || regexp_replace(coalesce(${post.publishedHtml}, ''), '<[^>]+>', ' ', 'g'))) like unaccent(${pattern})`,
    );
  }
  if (after) {
    const value = byTitle ? after.v : new Date(after.v);
    conditions.push(
      descending
        ? sql`(${key}, ${post.id}) < (${value}, ${after.id})`
        : sql`(${key}, ${post.id}) > (${value}, ${after.id})`,
    );
  }

  const order = descending ? desc : asc;
  const rows = await db
    .select({ ...cardColumns, titleKey })
    .from(post)
    .where(and(...conditions))
    .orderBy(order(key), order(post.id))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  const nextCursor =
    rows.length > PAGE_SIZE && last
      ? encodeCursor(byTitle ? last.titleKey : (last.publishedAt?.toISOString() ?? ""), last.id)
      : null;

  return { posts: page.map(({ titleKey: _, ...card }) => toCard(card)), nextCursor };
}

async function cachedAuthorPosts(authorId: string, sort: PostSort, cursor: string | null) {
  "use cache";
  cacheLife("max");
  cacheTag(authorTag(authorId));
  return queryAuthorPosts(authorId, "", sort, cursor);
}

export async function getAuthorPosts(authorId: string, query: string, sort: PostSort, cursor: string | null) {
  const q = query.trim().slice(0, 100);
  return q ? queryAuthorPosts(authorId, q, sort, cursor) : cachedAuthorPosts(authorId, sort, cursor);
}

export async function getPublishedPost(username: string, slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(authorUsernameTag(username));
  const author = await findVisibleAuthor(username);
  if (!author) return null;
  cacheTag(authorTag(author.id));

  const [row] = await db
    .select(articleColumns)
    .from(post)
    .where(and(eq(post.authorId, author.id), eq(post.slug, slug), livePost("published")))
    .limit(1);
  if (!row) return null;
  cacheTag(postTag(row.id));

  const sibling = (direction: "previous" | "next") =>
    db
      .select({ slug: post.slug, title: post.publishedTitle })
      .from(post)
      .where(
        and(
          eq(post.authorId, author.id),
          livePost("published"),
          direction === "previous"
            ? sql`(${post.publishedAt}, ${post.id}) < (${row.publishedAt}, ${row.id})`
            : sql`(${post.publishedAt}, ${post.id}) > (${row.publishedAt}, ${row.id})`,
        ),
      )
      .orderBy(
        ...(direction === "previous"
          ? [desc(post.publishedAt), desc(post.id)]
          : [asc(post.publishedAt), asc(post.id)]),
      )
      .limit(1);

  const [[previous], [next]] = await Promise.all([sibling("previous"), sibling("next")]);
  return { author, post: { ...toCard(row), html: row.html ?? "" }, previous, next };
}

export async function getUnlistedPost(shareId: string) {
  "use cache";
  cacheLife("max");
  cacheTag(postShareTag(shareId));
  const [row] = await db
    .select({
      ...articleColumns,
      status: post.status,
      author: {
        name: user.name,
        username: user.username,
        image: user.image,
        reactionsEnabled: user.reactionsEnabled,
      },
    })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(eq(post.shareId, shareId), isNull(post.deletedAt), visibleAuthor))
    .limit(1);
  if (!row || row.status === "draft") return null;
  cacheTag(postTag(row.id), authorTag(row.authorId));
  return row;
}

export async function getLatestPosts(limit = 5) {
  "use cache";
  cacheLife("max");
  cacheTag(LANDING_TAG);
  const rows = await db
    .select({ ...cardColumns, authorName: user.name, username: user.username })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(livePost("published"), visibleAuthor))
    .orderBy(desc(post.publishedAt))
    .limit(limit);
  return rows.map(toCard);
}

export async function getSitemapData() {
  "use cache";
  cacheLife("max");
  cacheTag(SITEMAP_TAG);
  const [authors, posts] = await Promise.all([
    db
      .select({
        username: user.username,
        updatedAt: sql<Date>`max(${post.lastPublishedAt})`.mapWith(post.lastPublishedAt),
      })
      .from(user)
      .innerJoin(post, and(eq(post.authorId, user.id), livePost("published")))
      .where(visibleAuthor)
      .groupBy(user.username),
    db
      .select({ username: user.username, slug: post.slug, lastPublishedAt: post.lastPublishedAt })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .where(and(livePost("published"), visibleAuthor))
      .orderBy(desc(post.publishedAt)),
  ]);
  return { authors, posts };
}

export async function getAuthorFeed(username: string) {
  "use cache";
  cacheLife("max");
  cacheTag(authorUsernameTag(username));
  const author = await findVisibleAuthor(username);
  if (!author) return null;
  cacheTag(authorTag(author.id));
  const posts = await db
    .select({ ...cardColumns, html: post.publishedHtml, lastPublishedAt: post.lastPublishedAt })
    .from(post)
    .where(and(eq(post.authorId, author.id), livePost("published")))
    .orderBy(desc(post.publishedAt), desc(post.id))
    .limit(50);
  return { author, posts: posts.map(toCard) };
}

export async function getSampleParams() {
  const rows = await db
    .select({ username: user.username, slug: post.slug })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(livePost("published"), visibleAuthor))
    .orderBy(desc(post.publishedAt))
    .limit(20)
    .catch(() => []);
  return rows;
}

export async function resolveRedirect(segments: string[]) {
  const path = `/${segments.join("/")}`;
  const exact = await getRedirect(path);
  if (exact) return exact;
  if (segments.length < 2) return null;
  const profile = await getRedirect(`/${segments[0]}`);
  return profile ? `${profile}/${segments.slice(1).join("/")}` : null;
}

export function toPostCardData(card: PostCard, username: string): PostCardData {
  return {
    id: card.id,
    href: `/${username}/${card.slug}`,
    title: card.title,
    excerpt: card.excerpt,
    dateIso: card.publishedAt.toISOString(),
    dateLabel: formatFrenchDate(card.publishedAt),
    readingMinutes: card.readingMinutes,
    thumbnailUrl: card.thumbnailUrl,
  };
}
