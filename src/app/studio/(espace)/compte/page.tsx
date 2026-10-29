import { and, count, desc, eq, gt, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { post, session } from "@/db/schema";
import { formatFrenchDateTime } from "@/lib/dates";
import { requireUser } from "@/lib/permissions";
import { describeUserAgent } from "@/lib/user-agent";
import { AccountSettings } from "./account-settings";

export const metadata: Metadata = { title: "Compte" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-read">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Compte</h1>
      <p className="mt-1 text-sm text-muted">Connexion, préférences et données.</p>
      <div className="mt-10">
        <Suspense fallback={<div className="h-96 rounded-xl bg-surface/60" aria-hidden="true" />}>
          <AccountLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function AccountLoader() {
  const { user, session: current } = await requireUser();
  const [sessions, [{ trashed }]] = await Promise.all([
    db
      .select({ id: session.id, userAgent: session.userAgent, updatedAt: session.updatedAt })
      .from(session)
      .where(and(eq(session.userId, user.id), gt(session.expiresAt, new Date())))
      .orderBy(desc(session.updatedAt)),
    db
      .select({ trashed: count() })
      .from(post)
      .where(and(eq(post.authorId, user.id), isNotNull(post.deletedAt))),
  ]);

  return (
    <AccountSettings
      account={{
        email: user.email,
        username: user.username,
        isSuperAdmin: user.role === "superadmin",
        reactionsEnabled: user.reactionsEnabled,
        frenchTypography: user.frenchTypography,
        theme: user.theme,
        trashed,
      }}
      sessions={sessions.map((s) => ({
        id: s.id,
        device: describeUserAgent(s.userAgent),
        lastActive: formatFrenchDateTime(s.updatedAt),
        current: s.id === current.id,
      }))}
    />
  );
}
