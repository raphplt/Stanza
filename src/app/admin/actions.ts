"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  accessRequest,
  backup,
  invitation,
  passwordReset,
  post,
  session,
  siteSettings,
  user,
} from "@/db/schema";
import { run } from "@/lib/action-utils";
import { runBackup } from "@/lib/backup-service";
import {
  invalidateAuthorPublicCache,
  invalidatePostPublicCache,
  invalidateSettingsCache,
} from "@/lib/cache-tags";
import { formatFrenchDateTime } from "@/lib/dates";
import { generateRandomToken, sha256Hex, uuidv7 } from "@/lib/id";
import { assertNotSelfAdminAction, PermissionError, requireActionSuperAdmin } from "@/lib/permissions";
import { applyUnpublish } from "@/lib/post-lifecycle";
import { invitationPath, invitationToken } from "@/lib/tokens";

const DAY_MS = 24 * 60 * 60 * 1000;

async function admin() {
  return (await requireActionSuperAdmin()).user;
}

async function loadUser(userId: string) {
  const row = await db.query.user.findFirst({ where: eq(user.id, z.uuid().parse(userId)) });
  if (!row) throw new PermissionError("Compte introuvable.", 404);
  return row;
}

async function setUser(target: { id: string; username: string }, patch: Partial<typeof user.$inferInsert>) {
  await db
    .update(user)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(user.id, target.id));
  invalidateAuthorPublicCache(target.id, target.username);
}

export async function suspendUserAction(userId: string) {
  return run(async () => {
    const me = await admin();
    const target = await loadUser(userId);
    assertNotSelfAdminAction(target.id, me.id);
    await setUser(target, { banned: true, banReason: "Suspendu par l'administrateur" });
    await db.delete(session).where(eq(session.userId, target.id));
    return {};
  });
}

export async function reactivateUserAction(userId: string) {
  return run(async () => {
    await admin();
    const target = await loadUser(userId);
    await setUser(target, { banned: false, banReason: null, banExpires: null });
    return {};
  });
}

export async function deleteUserAction(userId: string) {
  return run(async () => {
    const me = await admin();
    const target = await loadUser(userId);
    assertNotSelfAdminAction(target.id, me.id);
    await setUser(target, { status: "deleted", deletedAt: new Date() });
    await db.delete(session).where(eq(session.userId, target.id));
    return {};
  });
}

export async function restoreUserAction(userId: string) {
  return run(async () => {
    await admin();
    const target = await loadUser(userId);
    await setUser(target, { status: "active", deletedAt: null });
    return {};
  });
}

export async function revokeUserSessionsAction(userId: string) {
  return run(async () => {
    await admin();
    const target = await loadUser(userId);
    const removed = await db
      .delete(session)
      .where(eq(session.userId, target.id))
      .returning({ id: session.id });
    return { count: removed.length };
  });
}

export async function createResetLinkAction(userId: string) {
  return run(async () => {
    await admin();
    const target = await loadUser(userId);
    const token = generateRandomToken(32);
    await db.insert(passwordReset).values({
      id: uuidv7(),
      userId: target.id,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + DAY_MS),
    });
    return { path: `/reinitialiser/${token}` };
  });
}

export async function unpublishPostAsAdminAction(postId: string) {
  return run(async () => {
    await admin();
    const row = await db.query.post.findFirst({ where: eq(post.id, z.uuid().parse(postId)) });
    if (!row) throw new PermissionError("Texte introuvable.", 404);
    const author = await loadUser(row.authorId);
    await db
      .update(post)
      .set({ ...applyUnpublish(row), updatedAt: new Date() })
      .where(eq(post.id, row.id));
    invalidatePostPublicCache({
      postId: row.id,
      authorId: row.authorId,
      username: author.username,
      shareId: row.shareId,
    });
    return {};
  });
}

export async function hidePostAsAdminAction(postId: string) {
  return run(async () => {
    await admin();
    const row = await db.query.post.findFirst({ where: eq(post.id, z.uuid().parse(postId)) });
    if (row?.status !== "published") throw new PermissionError("Texte introuvable.", 404);
    const author = await loadUser(row.authorId);
    await db
      .update(post)
      .set({ status: "unlisted", pinnedAt: null, updatedAt: new Date() })
      .where(eq(post.id, row.id));
    invalidatePostPublicCache({
      postId: row.id,
      authorId: row.authorId,
      username: author.username,
      shareId: row.shareId,
    });
    return {};
  });
}

const invitationSchema = z.object({
  email: z.union([z.email("Adresse email invalide."), z.literal("")]).optional(),
  note: z.string().trim().max(200).optional(),
  days: z.int().min(1).max(30).default(7),
});

async function insertInvitation(createdBy: string, input: z.infer<typeof invitationSchema>) {
  const id = uuidv7();
  await db.insert(invitation).values({
    id,
    tokenHash: sha256Hex(invitationToken(id)),
    email: input.email ? input.email.toLowerCase() : null,
    note: input.note || null,
    createdBy,
    expiresAt: new Date(Date.now() + input.days * DAY_MS),
  });
  return id;
}

export async function createInvitationAction(input: z.input<typeof invitationSchema>) {
  return run(async () => {
    const me = await admin();
    const id = await insertInvitation(me.id, invitationSchema.parse(input));
    return { id, path: invitationPath(id) };
  });
}

export async function revokeInvitationAction(invitationId: string) {
  return run(async () => {
    await admin();
    await db
      .update(invitation)
      .set({ revokedAt: new Date() })
      .where(eq(invitation.id, z.uuid().parse(invitationId)));
    return {};
  });
}

export async function approveAccessRequestAction(requestId: string) {
  return run(async () => {
    const me = await admin();
    const request = await db.query.accessRequest.findFirst({
      where: eq(accessRequest.id, z.uuid().parse(requestId)),
    });
    if (!request) throw new PermissionError("Demande introuvable.", 404);
    const id = await insertInvitation(me.id, {
      email: request.email,
      note: `Demande de ${request.name}`.slice(0, 200),
      days: 7,
    });
    await db
      .update(accessRequest)
      .set({ status: "approved", handledAt: new Date() })
      .where(eq(accessRequest.id, request.id));
    return { path: invitationPath(id) };
  });
}

export async function setAccessRequestStatusAction(requestId: string, status: "rejected" | "archived") {
  return run(async () => {
    await admin();
    const value = z.enum(["rejected", "archived"]).parse(status);
    await db
      .update(accessRequest)
      .set({ status: value, handledAt: new Date() })
      .where(eq(accessRequest.id, z.uuid().parse(requestId)));
    return {};
  });
}

const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "Le nom du site est requis.").max(60),
  tagline: z.string().trim().max(160),
  landingText: z.string().trim().max(600),
  accessRequestsOpen: z.boolean(),
  showLatestPostsOnLanding: z.boolean(),
  readOnlyMode: z.boolean(),
  legalNotice: z.string().max(20_000),
});

export async function updateSettingsAction(input: z.infer<typeof settingsSchema>) {
  return run(async () => {
    await admin();
    const values = settingsSchema.parse(input);
    await db
      .insert(siteSettings)
      .values({ id: 1, ...values, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettings.id, set: { ...values, updatedAt: new Date() } });
    invalidateSettingsCache();
    return {};
  });
}

export async function runBackupNowAction() {
  return run(async () => {
    await admin();
    const result = await runBackup();
    if (result.status === "failed")
      throw new PermissionError(`Échec de la sauvegarde : ${result.error}`, 500);
    const row = await db.query.backup.findFirst({ where: eq(backup.id, result.id) });
    if (!row) throw new PermissionError("Sauvegarde introuvable.", 500);
    return {
      backup: {
        id: row.id,
        sizeBytes: row.sizeBytes,
        status: row.status,
        error: row.error,
        dateLabel: formatFrenchDateTime(row.createdAt),
      },
    };
  });
}
