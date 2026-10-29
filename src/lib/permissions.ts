import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db/client";
import { type UserRole, type UserStatus, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "./public-data";

export class PermissionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "PermissionError";
    this.statusCode = statusCode;
  }
}

export function isAccountPubliclyVisible(account: {
  banned: boolean;
  status: UserStatus;
  deletedAt?: Date | null;
}): boolean {
  return !account.banned && account.status === "active" && !account.deletedAt;
}

export function isAccountAllowedToAuthenticate(account: {
  banned: boolean;
  status: UserStatus;
  deletedAt?: Date | null;
}): boolean {
  return !account.banned && account.status !== "deleted" && !account.deletedAt;
}

export function assertOwner(resourceAuthorId: string, currentUserId: string): void {
  if (!resourceAuthorId || !currentUserId || resourceAuthorId !== currentUserId) {
    throw new PermissionError("Accès refusé : vous n'êtes pas propriétaire de cette ressource.", 403);
  }
}

export function assertSuperAdminRole(role: UserRole): void {
  if (role !== "superadmin") {
    throw new PermissionError("Accès réservé au super administrateur.", 403);
  }
}

export function assertNotSelfAdminAction(targetUserId: string, adminUserId: string): void {
  if (targetUserId === adminUserId) {
    throw new PermissionError(
      "Le super administrateur ne peut pas se suspendre ni se supprimer lui-même.",
      400,
    );
  }
}

export const getOptionalSession = cache(async () => {
  try {
    const reqHeaders = await headers();
    const sessionData = await auth.api.getSession({ headers: reqHeaders });
    if (!sessionData?.user?.id) {
      return null;
    }
    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, sessionData.user.id),
    });
    if (!dbUser || !isAccountAllowedToAuthenticate(dbUser)) {
      return null;
    }
    return {
      user: dbUser,
      session: sessionData.session,
    };
  } catch {
    return null;
  }
});

export async function requireUser() {
  const data = await getOptionalSession();
  if (!data) {
    redirect("/connexion");
  }
  return data;
}

export async function requireSuperAdmin() {
  const data = await requireUser();
  if (data.user.role !== "superadmin") {
    redirect("/studio");
  }
  return data;
}

export async function requireActionUser() {
  const data = await getOptionalSession();
  if (!data) {
    throw new PermissionError("Vous devez être connecté pour effectuer cette action.", 401);
  }
  return data;
}

export async function requireActionSuperAdmin() {
  const data = await requireActionUser();
  assertSuperAdminRole(data.user.role);
  return data;
}

export const isReadOnlyMode = cache(async (): Promise<boolean> => {
  const settings = await getSiteSettings();
  return Boolean(settings?.readOnlyMode);
});

export async function assertWritable(): Promise<void> {
  if (await isReadOnlyMode()) {
    throw new PermissionError("Le site est actuellement en mode lecture seule pour maintenance.", 503);
  }
}
