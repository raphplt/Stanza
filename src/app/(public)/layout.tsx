import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="mx-auto w-full max-w-read px-5 pb-10 text-center text-xs text-muted">
        <Link href="/mentions-legales" className="underline-offset-4 hover:text-ink hover:underline">
          Mentions légales et confidentialité
        </Link>
      </footer>
    </>
  );
}
