import Image from "next/image";
import Link from "next/link";

export type PostCardData = {
  id: string;
  href: string;
  title: string;
  excerpt: string;
  dateIso: string;
  dateLabel: string;
  readingMinutes: number;
  thumbnailUrl: string | null;
};

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="group relative flex gap-5 py-6">
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-xl leading-snug font-medium tracking-tight">
          <Link
            href={post.href}
            className="after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:decoration-line group-hover:underline-offset-4"
          >
            {post.title || "Sans titre"}
          </Link>
        </h2>
        {post.excerpt && <p className="mt-2 line-clamp-3 font-serif text-base text-muted">{post.excerpt}</p>}
        <p className="mt-3 text-xs text-muted">
          <time dateTime={post.dateIso}>{post.dateLabel}</time>
          <span aria-hidden="true"> · </span>
          {post.readingMinutes} min de lecture
        </p>
      </div>
      {post.thumbnailUrl && (
        <Image
          src={post.thumbnailUrl}
          alt=""
          width={112}
          height={112}
          sizes="112px"
          className="size-20 shrink-0 rounded-md bg-surface object-cover sm:size-28"
        />
      )}
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex gap-5 py-6" aria-hidden="true">
      <div className="flex-1">
        <div className="h-6 w-2/3 rounded bg-surface" />
        <div className="mt-3 h-4 w-full rounded bg-surface/70" />
        <div className="mt-2 h-4 w-5/6 rounded bg-surface/70" />
        <div className="mt-4 h-3 w-32 rounded bg-surface/70" />
      </div>
    </div>
  );
}
