import { count, desc, eq, max } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { post, session, user } from "@/db/schema";
import { formatFrenchDateTime, formatShortFrenchDate } from "@/lib/dates";
import { requireSuperAdmin } from "@/lib/permissions";
import { PageTitle, TableSkeleton } from "../ui";
import { type AccountRow, AccountsTable } from "./accounts-table";

export const metadata: Metadata = { title: "Comptes" };

export default function AccountsPage() {
  return (
    <>
      <PageTitle title="Comptes" description="Auteurs, statuts et accès." />
      <Suspense fallback={<TableSkeleton />}>
        <Accounts />
      </Suspense>
    </>
  );
}

async function Accounts() {
  const { user: me } = await requireSuperAdmin();
  const postCounts = db
    .select({ authorId: post.authorId, total: count().as("total") })
    .from(post)
    .groupBy(post.authorId)
    .as("post_counts");
  const lastSeen = db
    .select({ userId: session.userId, at: max(session.updatedAt).as("at") })
    .from(session)
    .groupBy(session.userId)
    .as("last_seen");

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      role: user.role,
      banned: user.banned,
      status: user.status,
      createdAt: user.createdAt,
      posts: postCounts.total,
      lastSeen: lastSeen.at,
    })
    .from(user)
    .leftJoin(postCounts, eq(postCounts.authorId, user.id))
    .leftJoin(lastSeen, eq(lastSeen.userId, user.id))
    .orderBy(desc(user.createdAt));

  const accounts: AccountRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    email: r.email,
    image: r.image,
    isSelf: r.id === me.id,
    isSuperAdmin: r.role === "superadmin",
    state: r.status === "deleted" ? "deleted" : r.banned ? "suspended" : r.status,
    posts: Number(r.posts ?? 0),
    lastSeen: r.lastSeen ? formatFrenchDateTime(r.lastSeen) : "Jamais",
    createdAt: formatShortFrenchDate(r.createdAt),
  }));

  return <AccountsTable accounts={accounts} />;
}
