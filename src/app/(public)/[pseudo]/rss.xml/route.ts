import { getAuthorFeed, getSiteSettings } from "@/lib/public-data";
import { absoluteUrl } from "@/lib/site";

function xml(value: string) {
  return value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function cdata(value: string) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export async function GET(_request: Request, { params }: RouteContext<"/[pseudo]/rss.xml">) {
  const { pseudo } = await params;
  const [feed, settings] = await Promise.all([getAuthorFeed(pseudo.toLowerCase()), getSiteSettings()]);
  if (!feed) return new Response("Introuvable", { status: 404 });

  const { author, posts } = feed;
  const profileUrl = absoluteUrl(`/${author.username}`);
  const items = posts
    .map((p) => {
      const url = absoluteUrl(`/${author.username}/${p.slug}`);
      return `    <item>
      <title>${xml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${p.id}</guid>
      <pubDate>${p.publishedAt.toUTCString()}</pubDate>
      <dc:creator>${xml(author.name)}</dc:creator>
      <description>${xml(p.excerpt)}</description>
      <content:encoded>${cdata(p.html ?? "")}</content:encoded>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(`${author.name} · ${settings.siteName}`)}</title>
    <link>${profileUrl}</link>
    <description>${xml(author.bio || `Les textes de ${author.name}`)}</description>
    <language>fr-FR</language>
    <atom:link href="${absoluteUrl(`/${author.username}/rss.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
