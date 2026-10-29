import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { accessRequest } from "@/db/schema";
import { formatFrenchDateTime } from "@/lib/dates";
import { requireSuperAdmin } from "@/lib/permissions";
import { PageTitle, TableSkeleton } from "../ui";
import { AccessRequests } from "./access-requests";

export const metadata: Metadata = { title: "Demandes d'accès" };

export default function AccessRequestsPage() {
  return (
    <>
      <PageTitle title="Demandes d'accès" description="Accepter crée une invitation et copie son lien." />
      <Suspense fallback={<TableSkeleton />}>
        <RequestsLoader />
      </Suspense>
    </>
  );
}

async function RequestsLoader() {
  await requireSuperAdmin();
  const rows = await db.select().from(accessRequest).orderBy(desc(accessRequest.createdAt)).limit(300);
  return (
    <AccessRequests
      initial={rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        status: r.status,
        date: formatFrenchDateTime(r.createdAt),
      }))}
    />
  );
}
