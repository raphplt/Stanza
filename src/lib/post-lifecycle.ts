import type { post } from "@/db/schema";
import {
  computeReadingStats,
  extractFirstImageUrl,
  generateDefaultExcerpt,
  renderProseMirrorToHtml,
  sanitizeProseMirrorJson,
} from "@/lib/render";
import { applyFrenchTypographyToText } from "@/lib/typo-fr";

export type PostRow = typeof post.$inferSelect;
export type PostPatch = Partial<PostRow>;

export function isLive(status: PostRow["status"]): boolean {
  return status === "published" || status === "unlisted";
}

export function applyDraftEdit(
  current: Pick<PostRow, "status" | "publishedTitle" | "publishedContent" | "version">,
  update: { title: string; content: unknown },
): PostPatch {
  const content = sanitizeProseMirrorJson(update.content);
  const hasUnpublishedChanges = isLive(current.status)
    ? update.title !== (current.publishedTitle ?? "") ||
      JSON.stringify(content) !== JSON.stringify(sanitizeProseMirrorJson(current.publishedContent))
    : false;

  return {
    title: update.title,
    content,
    hasUnpublishedChanges,
    ...computeReadingStats(update.title, content),
    version: current.version + 1,
  };
}

export function applyPublishOrUpdate(
  current: Pick<PostRow, "title" | "content" | "excerpt" | "ogImageUrl" | "publishedAt" | "version">,
  options: {
    targetStatus: "published" | "unlisted";
    slug: string;
    excerpt?: string;
    ogImageUrl?: string | null;
    frenchTypography: boolean;
    now?: Date;
  },
): PostPatch {
  const now = options.now ?? new Date();
  const content = sanitizeProseMirrorJson(current.content);
  const title = current.title.trim() || "Sans titre";
  const excerpt = (options.excerpt ?? current.excerpt).trim() || generateDefaultExcerpt(content);
  const ogImageUrl =
    options.ogImageUrl !== undefined
      ? options.ogImageUrl
      : (current.ogImageUrl ?? extractFirstImageUrl(content));

  return {
    status: options.targetStatus,
    slug: options.slug,
    title,
    content,
    excerpt,
    publishedTitle: title,
    publishedContent: content,
    publishedHtml: renderProseMirrorToHtml(content, { frenchTypography: options.frenchTypography }),
    publishedExcerpt: options.frenchTypography ? applyFrenchTypographyToText(excerpt) : excerpt,
    ogImageUrl,
    hasUnpublishedChanges: false,
    publishedAt: current.publishedAt ?? now,
    lastPublishedAt: now,
    firstImageUrl: extractFirstImageUrl(content),
    deletedAt: null,
    ...computeReadingStats(title, content),
    version: current.version + 1,
  };
}

export function applyDiscardUnpublishedChanges(
  current: Pick<
    PostRow,
    "title" | "content" | "excerpt" | "publishedTitle" | "publishedContent" | "publishedExcerpt" | "version"
  >,
): PostPatch {
  const title = current.publishedTitle ?? current.title;
  const content = current.publishedContent ?? current.content;

  return {
    title,
    content,
    excerpt: current.publishedExcerpt ?? current.excerpt,
    hasUnpublishedChanges: false,
    ...computeReadingStats(title, content),
    version: current.version + 1,
  };
}

export function applyUnpublish(current: Pick<PostRow, "version">): PostPatch {
  return { status: "draft", hasUnpublishedChanges: false, pinnedAt: null, version: current.version + 1 };
}

export function applySoftDelete(now = new Date()): PostPatch {
  return { deletedAt: now, pinnedAt: null };
}

export function applyRestoreFromTrash(current: Pick<PostRow, "version">): PostPatch {
  return {
    status: "draft",
    deletedAt: null,
    hasUnpublishedChanges: false,
    pinnedAt: null,
    version: current.version + 1,
  };
}
