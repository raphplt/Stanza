import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeaderFallback, SiteHeaderServer } from "@/components/ui/site-header-server";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer />
      </Suspense>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-24 sm:px-6 sm:pt-12">{children}</main>
    </>
  );
}
