import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { invitation, user } from "@/db/schema";
import { formatShortFrenchDate } from "@/lib/dates";
import { requireSuperAdmin } from "@/lib/permissions";
import { invitationPath } from "@/lib/tokens";
import { PageTitle, TableSkeleton } from "../ui";
import { type InvitationRow, Invitations } from "./invitations";

export const metadata: Metadata = { title: "Invitations" };

export default function InvitationsPage() {
  return (
    <>
      <PageTitle
        title="Invitations"
        description="Chaque invitation produit un lien à usage unique que vous envoyez vous-même."
      />
      <Suspense fallback={<TableSkeleton />}>
        <InvitationsLoader />
      </Suspense>
    </>
  );
}

async function InvitationsLoader() {
  await requireSuperAdmin();
  const now = new Date();
  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      note: invitation.note,
      expiresAt: invitation.expiresAt,
      usedAt: invitation.usedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
      usedBy: user.username,
    })
    .from(invitation)
    .leftJoin(user, eq(user.id, invitation.usedBy))
    .orderBy(desc(invitation.createdAt))
    .limit(200);

  const invitations: InvitationRow[] = rows.map((r) => {
    const state = r.usedAt ? "used" : r.revokedAt ? "revoked" : r.expiresAt <= now ? "expired" : "pending";
    return {
      id: r.id,
      email: r.email,
      note: r.note,
      state,
      usedBy: r.usedBy,
      createdAt: formatShortFrenchDate(r.createdAt),
      expiresAt: formatShortFrenchDate(r.expiresAt),
      path: state === "pending" ? invitationPath(r.id) : null,
    };
  });

  return <Invitations initial={invitations} />;
}
