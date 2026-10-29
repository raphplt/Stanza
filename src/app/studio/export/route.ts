import { eq, inArray } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { db } from "@/db/client";
import { post, postRevision } from "@/db/schema";
import { getOptionalSession } from "@/lib/permissions";
import { serializePostToMarkdown } from "@/lib/render";

export async function GET() {
  const current = await getOptionalSession();
  if (!current) return new Response("Non autorisé", { status: 401 });
  const me = current.user;

  const posts = await db.query.post.findMany({ where: eq(post.authorId, me.id) });
  const revisions = posts.length
    ? await db.query.postRevision.findMany({
        where: inArray(
          postRevision.postId,
          posts.map((p) => p.id),
        ),
      })
    : [];

  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const p of posts) {
    const folder = p.deletedAt ? "corbeille" : p.status === "draft" ? "brouillons" : "textes";
    const base = p.status === "draft" ? p.title.trim() || "sans-titre" : p.slug;
    const safe = base.replace(/[^\p{L}\p{N} _-]+/gu, "").slice(0, 80) || p.id;
    let name = `${folder}/${safe}.md`;
    for (let i = 2; used.has(name); i++) name = `${folder}/${safe}-${i}.md`;
    used.add(name);
    files[name] = strToU8(serializePostToMarkdown(p));
  }

  const profile = {
    name: me.name,
    username: me.username,
    email: me.email,
    bio: me.bio,
    image: me.image,
    links: me.links,
    reactionsEnabled: me.reactionsEnabled,
    frenchTypography: me.frenchTypography,
    theme: me.theme,
    createdAt: me.createdAt,
  };
  files["data.json"] = strToU8(
    JSON.stringify({ exportedAt: new Date().toISOString(), profile, posts, revisions }, null, 2),
  );

  const date = new Date().toISOString().slice(0, 10);
  return new Response(zipSync(files, { level: 6 }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="stanza-${me.username}-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
