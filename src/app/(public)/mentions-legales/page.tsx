import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeaderFallback, SiteHeaderServer } from "@/components/ui/site-header-server";
import { getSiteSettings } from "@/lib/public-data";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales et politique de confidentialité.",
  alternates: { canonical: "/mentions-legales" },
};

const HEADING = /^[^\s.!?:;,—–-][^.!?:;]{0,60}$/;

export default async function LegalPage() {
  const { legalNotice, siteName } = await getSiteSettings();
  const blocks = legalNotice
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer />
      </Suspense>
      <main className="mx-auto w-full max-w-read flex-1 px-5 pt-12 pb-20 sm:pt-20">
        <h1 className="font-serif text-4xl font-medium tracking-tight">Mentions légales</h1>
        <div className="prose-stanza mt-10">
          {blocks.length === 0 ? (
            <p>{siteName} n'a pas encore renseigné ses mentions légales.</p>
          ) : (
            blocks.map((block) => {
              const [first, ...rest] = block.split("\n");
              const titled = rest.length > 0 && HEADING.test(first.trim());
              const lines = titled ? rest : block.split("\n");
              return (
                <section key={block}>
                  {titled && <h2>{first.trim()}</h2>}
                  <p>
                    {lines.map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static lines of a text block
                      <span key={i}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </p>
                </section>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
