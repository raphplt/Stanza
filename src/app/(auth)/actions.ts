"use server";

import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { accessRequest, account, invitation, passwordReset, session, siteSettings, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { invalidateAuthorPublicCache } from "@/lib/cache-tags";
import { sha256Hex, uuidv7 } from "@/lib/id";
import { assertWritable, isAccountAllowedToAuthenticate } from "@/lib/permissions";
import { consumeRateLimit, getClientIpHash } from "@/lib/rate-limit";
import { isReservedUsername, isValidUsername, normalizeUsername } from "@/lib/slug";

const loginSchema = z.object({
  email: z.email("Adresse email invalide."),
  password: z.string().min(1, "Veuillez saisir votre mot de passe."),
});

export async function loginWithPasswordAction(input: z.infer<typeof loginSchema>) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (existing && !isAccountAllowedToAuthenticate(existing)) {
    return {
      ok: false as const,
      error: existing.banned ? "Ce compte a été suspendu par l'administrateur." : "Ce compte a été supprimé.",
    };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch {
    return { ok: false as const, error: "Identifiants incorrects." };
  }

  if (existing && existing.status === "deactivated") {
    await db.update(user).set({ status: "active", updatedAt: new Date() }).where(eq(user.id, existing.id));
    invalidateAuthorPublicCache(existing.id, existing.username);
  }

  return { ok: true as const };
}

export async function logoutAction() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch {}
  return { ok: true as const };
}

export async function checkUsernameAvailabilityAction(rawUsername: string, excludeUserId?: string) {
  const username = normalizeUsername(rawUsername);
  if (username.length < 3 || username.length > 30) {
    return { available: false, reason: "Le pseudo doit contenir entre 3 et 30 caractères." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return {
      available: false,
      reason: "Utilisez uniquement des lettres minuscules, chiffres, tirets (-) ou underscores (_).",
    };
  }
  if (isReservedUsername(username)) {
    return { available: false, reason: "Ce pseudo est réservé." };
  }
  const existing = await db.query.user.findFirst({
    where: sql`lower(${user.username}) = ${username}`,
  });
  if (existing && existing.id !== excludeUserId) {
    return { available: false, reason: "Ce pseudo est déjà utilisé." };
  }
  return { available: true, reason: "Pseudo disponible." };
}

const acceptInvitationSchema = z.object({
  token: z.string().min(16),
  name: z.string().trim().min(2, "Votre nom doit contenir au moins 2 caractères.").max(60),
  username: z.string().trim().min(3).max(30),
  email: z.email("Adresse email invalide."),
  password: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères.").max(128),
});

export async function acceptInvitationAction(input: z.infer<typeof acceptInvitationSchema>) {
  try {
    await assertWritable();
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Action indisponible." };
  }

  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const username = normalizeUsername(parsed.data.username);
  if (!isValidUsername(username)) {
    return {
      ok: false as const,
      error: isReservedUsername(username)
        ? "Ce pseudo est réservé."
        : "Le pseudo doit contenir 3 à 30 caractères (a-z, 0-9, -, _).",
    };
  }

  const tokenHash = sha256Hex(parsed.data.token.trim());
  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.tokenHash, tokenHash),
  });

  if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt <= new Date()) {
    return {
      ok: false as const,
      error: "Ce lien d'invitation est invalide, expiré ou a déjà été utilisé.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [existingEmail, existingUsername] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.email, email) }),
    db.query.user.findFirst({ where: sql`lower(${user.username}) = ${username}` }),
  ]);

  if (existingEmail) {
    return { ok: false as const, error: "Un compte utilise déjà cette adresse email." };
  }
  if (existingUsername) {
    return { ok: false as const, error: "Ce pseudo est déjà pris." };
  }

  const userId = uuidv7();
  const hashedPassword = await hashPassword(parsed.data.password);

  await db.insert(user).values({
    id: userId,
    name: parsed.data.name.trim(),
    username,
    email,
    emailVerified: true,
    role: "author",
    status: "active",
    bio: "",
    links: [],
  });

  await db.insert(account).values({
    id: uuidv7(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashedPassword,
  });

  await db.update(invitation).set({ usedAt: new Date(), usedBy: userId }).where(eq(invitation.id, inv.id));

  await auth.api.signInEmail({
    body: {
      email,
      password: parsed.data.password,
    },
    headers: await headers(),
  });

  invalidateAuthorPublicCache(userId, username);
  return { ok: true as const };
}

const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(12, "Le nouveau mot de passe doit contenir au moins 12 caractères.").max(128),
});

export async function resetPasswordWithTokenAction(input: z.infer<typeof resetPasswordSchema>) {
  try {
    await assertWritable();
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Action indisponible." };
  }

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const tokenHash = sha256Hex(parsed.data.token.trim());
  const resetRow = await db.query.passwordReset.findFirst({
    where: eq(passwordReset.tokenHash, tokenHash),
  });

  if (!resetRow || resetRow.usedAt || resetRow.expiresAt <= new Date()) {
    return {
      ok: false as const,
      error: "Ce lien de réinitialisation est invalide, expiré ou déjà utilisé.",
    };
  }

  const targetUser = await db.query.user.findFirst({
    where: eq(user.id, resetRow.userId),
  });

  if (!targetUser || !isAccountAllowedToAuthenticate(targetUser)) {
    return { ok: false as const, error: "Ce compte ne peut pas être réinitialisé." };
  }

  const hashedPassword = await hashPassword(parsed.data.password);
  const existingAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, targetUser.id), eq(account.providerId, "credential")),
  });

  if (existingAccount) {
    await db
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(account.id, existingAccount.id));
  } else {
    await db.insert(account).values({
      id: uuidv7(),
      accountId: targetUser.id,
      providerId: "credential",
      userId: targetUser.id,
      password: hashedPassword,
    });
  }

  await db.update(passwordReset).set({ usedAt: new Date() }).where(eq(passwordReset.id, resetRow.id));

  await db.delete(session).where(eq(session.userId, targetUser.id));

  return { ok: true as const };
}

const accessRequestSchema = z.object({
  name: z.string().trim().min(2, "Veuillez indiquer votre nom.").max(80),
  email: z.email("Veuillez indiquer une adresse email valide."),
  message: z
    .string()
    .trim()
    .min(10, "Présentez votre démarche en quelques mots (10 caractères min.).")
    .max(600, "Le message ne peut pas dépasser 600 caractères."),
  website: z.string().optional(),
  startedAt: z.number(),
});

export async function submitAccessRequestAction(input: z.infer<typeof accessRequestSchema>) {
  try {
    await assertWritable();
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Action indisponible." };
  }

  const parsed = accessRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return { ok: true as const };
  }

  if (Date.now() - parsed.data.startedAt < 1200) {
    return {
      ok: false as const,
      error: "Envoi trop rapide. Prenez une seconde avant de soumettre votre demande.",
    };
  }

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });

  if (settings && !settings.accessRequestsOpen) {
    return {
      ok: false as const,
      error: "Les demandes d'accès sont actuellement fermées.",
    };
  }

  const ipHash = await getClientIpHash();
  const limit = await consumeRateLimit(`access-request:${ipHash}`, 3, 3600);
  if (!limit.allowed) {
    return {
      ok: false as const,
      error: "Trop de demandes envoyées depuis cette adresse. Veuillez réessayer plus tard.",
    };
  }

  await db.insert(accessRequest).values({
    id: uuidv7(),
    name: parsed.data.name,
    email: parsed.data.email.trim().toLowerCase(),
    message: parsed.data.message,
    status: "pending",
  });

  return { ok: true as const };
}
