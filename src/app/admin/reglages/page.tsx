import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/permissions";
import { PageTitle } from "../ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Réglages" };

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Réglages du site" />
      <Suspense fallback={<div className="h-96 rounded-xl bg-surface/60" aria-hidden="true" />}>
        <SettingsLoader />
      </Suspense>
    </>
  );
}

async function SettingsLoader() {
  await requireSuperAdmin();
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  return (
    <SettingsForm
      initial={{
        siteName: row?.siteName ?? "Stanza",
        tagline: row?.tagline ?? "",
        landingText: row?.landingText ?? "",
        accessRequestsOpen: row?.accessRequestsOpen ?? true,
        showLatestPostsOnLanding: row?.showLatestPostsOnLanding ?? false,
        readOnlyMode: row?.readOnlyMode ?? false,
        legalNotice: row?.legalNotice ?? "",
      }}
    />
  );
}
