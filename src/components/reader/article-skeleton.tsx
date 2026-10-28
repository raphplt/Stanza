export function ArticleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-read px-5" aria-hidden="true">
      <div className="h-12 w-4/5 rounded-lg bg-surface" />
      <div className="mt-6 h-8 w-64 rounded-full bg-surface/70" />
      <div className="mt-10 space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 rounded bg-surface/60" />
        ))}
      </div>
    </div>
  );
}
