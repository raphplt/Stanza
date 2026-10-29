import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeaderFallback, SiteHeaderServer } from "@/components/ui/site-header-server";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Stanza" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer />
      </Suspense>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-24 sm:px-6 sm:pt-10">
        <AdminNav />
        <div className="mt-8">{children}</div>
      </main>
    </>
  );
}
