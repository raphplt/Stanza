"use server";

import type { JSONContent } from "@tiptap/core";
import { and, count, desc, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db/client";
import { post, postRevision, type RevisionReason, redirectTable, user } from "@/db/schema";
import {
  invalidateAuthorPublicCache,
  invalidatePostPublicCache,
  postShareTag,
  REDIRECTS_TAG,
  touchTag,
} from "@/lib/cache-tags";
import { uuidv7 } from "@/lib/id";
import { assertOwner, assertWritable, PermissionError, requireActionUser } from "@/lib/permissions";
import {
  applyDiscardUnpublishedChanges,
  applyDraftEdit,
  applyPublishOrUpdate,
  applyRestoreFromTrash,
  applySoftDelete,
  applyUnpublish,
  isLive,
  type PostRow,
} from "@/lib/post-lifecycle";
import {
  extractImageUrls,
  generateDefaultExcerpt,
  renderProseMirrorToHtml,
  sanitizeProseMirrorJson,
} from "@/lib/render";
import { slugify } from "@/lib/slug";

const MAX_REVISIONS = 50;
const AUTO_REVISION_INTERVAL_MS = 10 * 60 * 1000;
const MAX_PINNED = 3;
const MAX_CONTENT_BYTES = 1_000_000;

type Failure = { ok: false; error: string };
type Result<T = object> = ({ ok: true } & T) | Failure;

async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof PermissionError || e instanceof z.ZodError) {
      return {
        ok: false,
        error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Données invalides.") : e.message,
      };
    }
    console.error(e);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}

async function requireWriter() {
  const data = await requireActionUser();
  await assertWritable();
  return data.user;
}

async function loadOwnedPost(postId: string, userId: string): Promise<PostRow> {
  const row = await db.query.post.findFirst({ where: eq(post.id, z.uuid().parse(postId)) });
  if (!row) throw new PermissionError("Texte introuvable.", 404);
  assertOwner(row.authorId, userId);
  return row;
}

function revisionInsert(postId: string, title: string, content: JSONContent, reason: RevisionReason) {
  return db.insert(postRevision).values({ id: uuidv7(), postId, title, content, reason });
}

function pruneRevisions(postId: string) {
  return db
    .delete(postRevision)
    .where(
      and(
        eq(postRevision.postId, postId),
        notInArray(
          postRevision.id,
          db
            .select({ id: postRevision.id })
            .from(postRevision)
            .where(eq(postRevision.postId, postId))
            .orderBy(desc(postRevision.createdAt))
            .limit(MAX_REVISIONS),
        ),
      ),
    );
}

function invalidatePost(row: Pick<PostRow, "id" | "authorId" | "shareId">, username: string) {
  invalidatePostPublicCache({
    postId: row.id,
    authorId: row.authorId,
    username,
    shareId: row.shareId,
  });
}

function parseContent(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new PermissionError("Contenu illisible.", 400);
  }
}

function hasContent(content: JSONContent, title: string): boolean {
  return title.trim().length > 0 || JSON.stringify(content).includes('"text"');
}

export async function createDraftPostAction() {
  return run(async () => {
    const me = await requireWriter();
    const id = uuidv7();
    await db.insert(post).values({ id, authorId: me.id, slug: id, shareId: nanoid(12) });
    return { postId: id };
  });
}

const saveSchema = z.object({
  postId: z.uuid(),
  title: z.string().max(300, "Le titre ne peut pas dépasser 300 caractères."),
  content: z.string().max(MAX_CONTENT_BYTES, "Ce texte est trop long pour être enregistré."),
  baseVersion: z.int().positive(),
  force: z.boolean().optional(),
});

export type SaveDraftResult =
  | { ok: true; version: number; hasUnpublishedChanges: boolean }
  | { ok: false; conflict: true; error: string }
  | { ok: false; conflict?: false; error: string };

export async function saveDraftAction(input: z.infer<typeof saveSchema>): Promise<SaveDraftResult> {
  const conflict = {
    ok: false as const,
    conflict: true as const,
    error: "Ce texte a été modifié ailleurs.",
  };
  const result = await run(async () => {
    const me = await requireWriter();
    const data = saveSchema.parse(input);
    const current = await loadOwnedPost(data.postId, me.id);
    if (current.deletedAt) {
      throw new PermissionError("Ce texte est dans la corbeille. Restaurez-le pour le modifier.", 409);
    }
    if (!data.force && current.version !== data.baseVersion) return { conflict: true as const };

    const patch = applyDraftEdit(current, { title: data.title, content: parseContent(data.content) });
    const [updated] = await db
      .update(post)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(post.id, current.id), eq(post.version, current.version)))
      .returning({ version: post.version, hasUnpublishedChanges: post.hasUnpublishedChanges });
    if (!updated) return { conflict: true as const };

    const lastRevision = await db.query.postRevision.findFirst({
      where: eq(postRevision.postId, current.id),
      orderBy: desc(postRevision.createdAt),
      columns: { createdAt: true },
    });
    const snapshotDue =
      !lastRevision || Date.now() - lastRevision.createdAt.getTime() > AUTO_REVISION_INTERVAL_MS;
    if (snapshotDue && hasContent(current.content, current.title)) {
      await db.batch([
        revisionInsert(current.id, current.title, current.content, "auto"),
        pruneRevisions(current.id),
      ]);
    }

    return { conflict: false as const, ...updated };
  });

  if (!result.ok) return result;
  if (result.conflict) return conflict;
  return { ok: true, version: result.version, hasUnpublishedChanges: result.hasUnpublishedChanges };
}

export async function getPublishDraftAction(postId: string) {
  return run(async () => {
    const { user: me } = await requireActionUser();
    const row = await loadOwnedPost(postId, me.id);
    const content = sanitizeProseMirrorJson(row.content);
    const images = extractImageUrls(content);
    return {
      slug: row.publishedAt && row.slug !== row.id ? row.slug : slugify(row.title),
      excerpt: row.excerpt || generateDefaultExcerpt(content),
      images,
      ogImageUrl: row.publishedAt ? row.ogImageUrl : (images[0] ?? null),
    };
  });
}

const publishSchema = z.object({
  postId: z.uuid(),
  status: z.enum(["published", "unlisted"]),
  slug: z
    .string()
    .trim()
    .min(1, "L'adresse ne peut pas être vide.")
    .max(80, "L'adresse ne peut pas dépasser 80 caractères.")
    .refine((value) => slugify(value) === value, {
      message: "L'adresse ne peut contenir que des lettres minuscules, chiffres et tirets.",
    }),
  excerpt: z.string().trim().max(300, "L'extrait ne peut pas dépasser 300 caractères."),
  ogImageUrl: z.string().nullable(),
});

export async function publishPostAction(input: z.infer<typeof publishSchema>) {
  return run(async () => {
    const me = await requireWriter();
    const data = publishSchema.parse(input);
    const current = await loadOwnedPost(data.postId, me.id);
    if (current.deletedAt) {
      throw new PermissionError("Ce texte est dans la corbeille.", 409);
    }

    const slugOwner = await db.query.post.findFirst({
      where: and(eq(post.authorId, me.id), eq(post.slug, data.slug)),
      columns: { id: true },
    });
    if (slugOwner && slugOwner.id !== current.id) {
      throw new PermissionError("Cette adresse est déjà utilisée par un autre de vos textes.", 409);
    }

    const images = extractImageUrls(current.content);
    const ogImageUrl = data.ogImageUrl && images.includes(data.ogImageUrl) ? data.ogImageUrl : null;
    const patch = applyPublishOrUpdate(current, {
      targetStatus: data.status,
      slug: data.slug,
      excerpt: data.excerpt,
      ogImageUrl,
      frenchTypography: me.frenchTypography,
    });

    const oldPath = `/${me.username}/${current.slug}`;
    const newPath = `/${me.username}/${data.slug}`;
    const slugChanged =
      Boolean(current.publishedAt) && current.slug !== current.id && current.slug !== data.slug;

    const [updated] = await db.batch([
      db
        .update(post)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(post.id, current.id))
        .returning(),
      revisionInsert(current.id, patch.title ?? current.title, patch.content ?? current.content, "publish"),
      pruneRevisions(current.id),
      db.delete(redirectTable).where(eq(redirectTable.fromPath, newPath)),
      ...(slugChanged
        ? [
            db.update(redirectTable).set({ toPath: newPath }).where(eq(redirectTable.toPath, oldPath)),
            db
              .insert(redirectTable)
              .values({ fromPath: oldPath, toPath: newPath })
              .onConflictDoUpdate({ target: redirectTable.fromPath, set: { toPath: newPath } }),
          ]
        : []),
    ]);

    invalidatePost(current, me.username);
    touchTag(REDIRECTS_TAG);

    const row = updated[0] as PostRow;
    return {
      version: row.version,
      status: row.status,
      slug: row.slug,
      shareId: row.shareId,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  });
}

export async function discardChangesAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    if (!isLive(current.status)) {
      throw new PermissionError("Ce texte n'a pas de version en ligne.", 409);
    }
    const [row] = await db
      .update(post)
      .set({ ...applyDiscardUnpublishedChanges(current), updatedAt: new Date() })
      .where(eq(post.id, current.id))
      .returning();
    return { version: row.version, title: row.title, content: row.content };
  });
}

export async function unpublishPostAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    const [row] = await db
      .update(post)
      .set({ ...applyUnpublish(current), updatedAt: new Date() })
      .where(eq(post.id, current.id))
      .returning({ version: post.version });
    invalidatePost(current, me.username);
    return { version: row.version };
  });
}

export async function trashPostAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    await db
      .update(post)
      .set({ ...applySoftDelete(), updatedAt: new Date() })
      .where(eq(post.id, current.id));
    if (isLive(current.status)) invalidatePost(current, me.username);
    return {};
  });
}

export async function restorePostAction(postId: string, options: { undo?: boolean } = {}) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    const patch = options.undo ? { deletedAt: null } : applyRestoreFromTrash(current);
    await db
      .update(post)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(post.id, current.id));
    if (options.undo && isLive(current.status)) invalidatePost(current, me.username);
    return {};
  });
}

export async function purgePostAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    if (!current.deletedAt) {
      throw new PermissionError(
        "Seuls les textes de la corbeille peuvent être supprimés définitivement.",
        409,
      );
    }
    await db.delete(post).where(eq(post.id, current.id));
    return {};
  });
}

export async function emptyTrashAction() {
  return run(async () => {
    const me = await requireWriter();
    const deleted = await db
      .delete(post)
      .where(and(eq(post.authorId, me.id), isNotNull(post.deletedAt)))
      .returning({ id: post.id });
    return { count: deleted.length };
  });
}

export async function duplicatePostAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const source = await loadOwnedPost(postId, me.id);
    const id = uuidv7();
    const title = source.title ? `${source.title} (copie)`.slice(0, 300) : "";
    const [row] = await db
      .insert(post)
      .values({
        id,
        authorId: me.id,
        slug: id,
        shareId: nanoid(12),
        title,
        content: source.content,
        wordCount: source.wordCount,
        readingMinutes: source.readingMinutes,
      })
      .returning();
    return {
      post: {
        id: row.id,
        title: row.title,
        snippet: generateDefaultExcerpt(row.content),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  });
}

export async function togglePinAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    if (current.status !== "published" || current.deletedAt) {
      throw new PermissionError("Seuls les textes publiés peuvent être épinglés.", 409);
    }
    if (!current.pinnedAt) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(post)
        .where(and(eq(post.authorId, me.id), isNotNull(post.pinnedAt), isNull(post.deletedAt)));
      if (value >= MAX_PINNED) {
        throw new PermissionError(`Vous pouvez épingler ${MAX_PINNED} textes au maximum.`, 409);
      }
    }
    const pinnedAt = current.pinnedAt ? null : new Date();
    await db.update(post).set({ pinnedAt }).where(eq(post.id, current.id));
    invalidateAuthorPublicCache(me.id, me.username);
    return { pinned: Boolean(pinnedAt) };
  });
}

export async function regenerateShareIdAction(postId: string) {
  return run(async () => {
    const me = await requireWriter();
    const current = await loadOwnedPost(postId, me.id);
    const shareId = nanoid(12);
    await db.update(post).set({ shareId }).where(eq(post.id, current.id));
    touchTag(postShareTag(current.shareId));
    return { shareId };
  });
}

export async function listRevisionsAction(postId: string) {
  return run(async () => {
    const { user: me } = await requireActionUser();
    const current = await loadOwnedPost(postId, me.id);
    const rows = await db.query.postRevision.findMany({
      where: eq(postRevision.postId, current.id),
      orderBy: desc(postRevision.createdAt),
      columns: { id: true, title: true, reason: true, createdAt: true },
    });
    return {
      revisions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  });
}

async function loadOwnedRevision(revisionId: string, userId: string) {
  const revision = await db.query.postRevision.findFirst({
    where: eq(postRevision.id, z.uuid().parse(revisionId)),
  });
  if (!revision) throw new PermissionError("Version introuvable.", 404);
  const owner = await loadOwnedPost(revision.postId, userId);
  return { revision, owner };
}

export async function getRevisionPreviewAction(revisionId: string) {
  return run(async () => {
    const { user: me } = await requireActionUser();
    const { revision } = await loadOwnedRevision(revisionId, me.id);
    return {
      title: revision.title,
      html: renderProseMirrorToHtml(revision.content, { frenchTypography: me.frenchTypography }),
    };
  });
}

export async function restoreRevisionAction(revisionId: string) {
  return run(async () => {
    const me = await requireWriter();
    const { revision, owner } = await loadOwnedRevision(revisionId, me.id);
    if (owner.deletedAt) throw new PermissionError("Ce texte est dans la corbeille.", 409);
    const patch = applyDraftEdit(owner, { title: revision.title, content: revision.content });
    const [[row]] = await db.batch([
      db
        .update(post)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(post.id, owner.id))
        .returning({
          version: post.version,
          title: post.title,
          content: post.content,
          hasUnpublishedChanges: post.hasUnpublishedChanges,
        }),
      revisionInsert(owner.id, owner.title, owner.content, "restore"),
      pruneRevisions(owner.id),
    ]);
    return row;
  });
}

export async function dismissChecklistAction() {
  return run(async () => {
    const { user: me } = await requireActionUser();
    await db.update(user).set({ checklistDismissed: true }).where(eq(user.id, me.id));
    return {};
  });
}
