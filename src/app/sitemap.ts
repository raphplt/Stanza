import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/public-data";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { authors, posts } = await getSitemapData();
  const latest = posts.reduce<Date | undefined>(
    (max, p) => (p.lastPublishedAt && (!max || p.lastPublishedAt > max) ? p.lastPublishedAt : max),
    undefined,
  );
  return [
    { url: absoluteUrl("/"), lastModified: latest },
    ...authors.map((a) => ({ url: absoluteUrl(`/${a.username}`), lastModified: a.updatedAt ?? undefined })),
    ...posts.map((p) => ({
      url: absoluteUrl(`/${p.username}/${p.slug}`),
      lastModified: p.lastPublishedAt ?? undefined,
    })),
  ];
}
