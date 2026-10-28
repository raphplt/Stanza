"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, useTransition } from "react";
import { PostCard, type PostCardData, PostCardSkeleton } from "@/components/reader/post-card";
import type { PostSort } from "@/lib/public-data";
import { loadMoreProfilePostsAction } from "./actions";

const SORT_LABELS: Record<PostSort, string> = {
  recents: "Plus récents",
  anciens: "Plus anciens",
  "a-z": "Titre, de A à Z",
  "z-a": "Titre, de Z à A",
};

const ControlsContext = createContext({ pending: false, clearSearch: () => {} });

export function ProfileControls({
  query: initialQuery,
  sort: initialSort,
  children,
}: {
  query: string;
  sort: PostSort;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (sort !== "recents") params.set("tri", sort);
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sort, pathname, router]);

  return (
    <ControlsContext value={{ pending, clearSearch: () => setQuery("") }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Rechercher dans les textes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="tap w-full rounded-lg border border-line bg-paper px-3.5 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none sm:text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Trier</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as PostSort)}
            className="tap rounded-lg border border-line bg-paper px-3 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
        {children}
      </div>
    </ControlsContext>
  );
}

export function ClearSearchButton() {
  const { pending, clearSearch } = use(ControlsContext);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={clearSearch}
      className="tap mt-4 rounded-full border border-line px-4 text-sm hover:bg-surface"
    >
      Effacer la recherche
    </button>
  );
}

export function MorePosts({
  username,
  query,
  sort,
  cursor: initialCursor,
}: {
  username: string;
  query: string;
  sort: PostSort;
  cursor: string | null;
}) {
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || loading) return;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setLoading(true);
        const page = await loadMoreProfilePostsAction({ username, query, sort, cursor });
        setPosts((list) => [...list, ...page.posts]);
        setCursor(page.nextCursor);
        setLoading(false);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, username, query, sort]);

  return (
    <>
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard post={post} />
        </li>
      ))}
      {cursor && (
        <li ref={sentinel} aria-hidden="true">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </li>
      )}
    </>
  );
}
