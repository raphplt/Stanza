import Image from "next/image";
import Link from "next/link";

export type ArticleAuthor = { name: string; username: string; image: string | null };

export function PostArticle({
  title,
  html,
  author,
  date,
  modified,
  readingMinutes,
}: {
  title: string;
  html: string;
  author: ArticleAuthor;
  date: { iso: string; label: string } | null;
  modified?: { iso: string; label: string } | null;
  readingMinutes: number;
}) {
  return (
    <article className="mx-auto w-full max-w-read px-5">
      <header>
        <h1 className="font-serif text-4xl leading-tight font-medium tracking-tight sm:text-5xl">
          {title || "Sans titre"}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <Link href={`/${author.username}`} className="flex items-center gap-2.5 text-ink hover:underline">
            {author.image ? (
              <Image
                src={author.image}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full border border-line bg-surface font-serif">
                {author.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            {author.name}
          </Link>
          {date && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={date.iso}>{date.label}</time>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{readingMinutes} min de lecture</span>
        </div>
        {modified && (
          <p className="mt-2 text-xs text-muted">
            Modifié le <time dateTime={modified.iso}>{modified.label}</time>
          </p>
        )}
      </header>
      <div
        className="prose-stanza mt-10"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered server-side from whitelisted ProseMirror JSON
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
