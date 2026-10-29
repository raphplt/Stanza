"use server";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { account, redirectTable, session, user } from "@/db/schema";
import { requireWriter, run } from "@/lib/action-utils";
import { authorUsernameTag, invalidateAuthorPublicCache, REDIRECTS_TAG, touchTag } from "@/lib/cache-tags";
import { getOptionalSession, PermissionError } from "@/lib/permissions";
import { isReservedUsername, normalizeUsername, USERNAME_REGEX } from "@/lib/slug";

type Me = Awaited<ReturnType<typeof requireWriter>>;

async function updateMe(me: Me, patch: Partial<typeof user.$inferInsert>) {
  await db
    .update(user)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(user.id, me.id));
  invalidateAuthorPublicCache(me.id, me.username);
}

async function assertPassword(userId: string, password: string) {
  const row = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "credential")),
  });
  if (!row?.password || !(await verifyPassword({ hash: row.password, password }))) {
    throw new PermissionError("Mot de passe incorrect.", 400);
  }
  return row;
}

export async function updateNameAction(name: string) {
  return run(async () => {
    const me = await requireWriter();
    const value = z
      .string()
      .trim()
      .min(2, "Votre nom doit contenir au moins 2 caractères.")
      .max(60)
      .parse(name);
    await updateMe(me, { name: value });
    return { name: value };
  });
}

export async function updateBioAction(bio: string) {
  return run(async () => {
    const me = await requireWriter();
    const value = z.string().trim().max(300, "La bio ne peut pas dépasser 300 caractères.").parse(bio);
    await updateMe(me, { bio: value });
    return { bio: value };
  });
}

const linkSchema = z.object({
  label: z.string().trim().min(1, "Chaque lien a besoin d'un libellé.").max(40),
  url: z.url({ protocol: /^https?$/, error: "Adresse invalide (http ou https)." }).max(300),
});

export async function updateLinksAction(links: { label: string; url: string }[]) {
  return run(async () => {
    const me = await requireWriter();
    const value = z.array(linkSchema).max(3, "Trois liens au maximum.").parse(links);
    await updateMe(me, { links: value });
    return { links: value };
  });
}

function isOwnUpload(url: string, userId: string) {
  if (url.startsWith(`/api/upload/local/media/${userId}/`)) return !url.includes("..");
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/media/${userId}/`)
    );
  } catch {
    return false;
  }
}

export async function updateAvatarAction(url: string | null) {
  return run(async () => {
    const me = await requireWriter();
    if (url !== null && !isOwnUpload(url, me.id)) throw new PermissionError("Image invalide.", 400);
    await updateMe(me, { image: url });
    return { image: url };
  });
}

export async function updateUsernameAction(raw: string) {
  return run(async () => {
    const me = await requireWriter();
    const username = normalizeUsername(raw);
    if (!USERNAME_REGEX.test(username)) {
      throw new PermissionError("Le pseudo doit contenir 3 à 30 caractères (a-z, 0-9, -, _).", 400);
    }
    if (isReservedUsername(username)) throw new PermissionError("Ce pseudo est réservé.", 400);
    if (username === me.username) return { username };
    const taken = await db.query.user.findFirst({
      where: and(sql`lower(${user.username}) = ${username}`, ne(user.id, me.id)),
    });
    if (taken) throw new PermissionError("Ce pseudo est déjà utilisé.", 400);

    const from = `/${me.username}`;
    const to = `/${username}`;
    await db.batch([
      db.update(user).set({ username, updatedAt: new Date() }).where(eq(user.id, me.id)),
      db.delete(redirectTable).where(eq(redirectTable.fromPath, to)),
      db
        .update(redirectTable)
        .set({ toPath: sql`${to} || substr(${redirectTable.toPath}, ${from.length + 1})` })
        .where(sql`${redirectTable.toPath} = ${from} or starts_with(${redirectTable.toPath}, ${`${from}/`})`),
      db
        .insert(redirectTable)
        .values({ fromPath: from, toPath: to })
        .onConflictDoUpdate({ target: redirectTable.fromPath, set: { toPath: to } }),
    ]);
    invalidateAuthorPublicCache(me.id, me.username);
    touchTag(authorUsernameTag(username));
    touchTag(REDIRECTS_TAG);
    return { username };
  });
}

const preferencesSchema = z.object({
  reactionsEnabled: z.boolean().optional(),
  frenchTypography: z.boolean().optional(),
  theme: z.enum(["auto", "light", "dark"]).optional(),
});

export async function updatePreferencesAction(input: z.infer<typeof preferencesSchema>) {
  return run(async () => {
    const me = await requireWriter();
    const patch = preferencesSchema.parse(input);
    await updateMe(me, patch);
    return {};
  });
}

export async function changeEmailAction(input: { email: string; password: string }) {
  return run(async () => {
    const me = await requireWriter();
    const email = z.email("Adresse email invalide.").parse(input.email.trim().toLowerCase());
    await assertPassword(me.id, input.password);
    if (email === me.email) return { email };
    const taken = await db.query.user.findFirst({ where: eq(user.email, email) });
    if (taken) throw new PermissionError("Un compte utilise déjà cette adresse email.", 400);
    await db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.id, me.id));
    return { email };
  });
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string }) {
  return run(async () => {
    const me = await requireWriter();
    const newPassword = z
      .string()
      .min(12, "Le nouveau mot de passe doit contenir au moins 12 caractères.")
      .max(128)
      .parse(input.newPassword);
    const row = await assertPassword(me.id, input.currentPassword);
    await db
      .update(account)
      .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(account.id, row.id));
    return {};
  });
}

export async function revokeOtherSessionsAction() {
  return run(async () => {
    const current = await getOptionalSession();
    if (!current) throw new PermissionError("Vous devez être connecté.", 401);
    const removed = await db
      .delete(session)
      .where(and(eq(session.userId, current.user.id), ne(session.id, current.session.id)))
      .returning({ id: session.id });
    return { count: removed.length };
  });
}

export async function deactivateAccountAction() {
  return run(async () => {
    const me = await requireWriter();
    await db.batch([
      db.update(user).set({ status: "deactivated", updatedAt: new Date() }).where(eq(user.id, me.id)),
      db.delete(session).where(eq(session.userId, me.id)),
    ]);
    invalidateAuthorPublicCache(me.id, me.username);
    return {};
  });
}

export async function deleteAccountAction(input: { username: string; password: string }) {
  return run(async () => {
    const me = await requireWriter();
    if (me.role === "superadmin") {
      throw new PermissionError("Le super administrateur ne peut pas supprimer son propre compte.", 400);
    }
    if (normalizeUsername(input.username) !== me.username) {
      throw new PermissionError("Le pseudo saisi ne correspond pas.", 400);
    }
    await assertPassword(me.id, input.password);
    const now = new Date();
    await db.batch([
      db.update(user).set({ status: "deleted", deletedAt: now, updatedAt: now }).where(eq(user.id, me.id)),
      db.delete(session).where(eq(session.userId, me.id)),
    ]);
    invalidateAuthorPublicCache(me.id, me.username);
    return {};
  });
}
