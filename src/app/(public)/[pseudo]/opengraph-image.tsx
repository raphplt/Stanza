import { notFound } from "next/navigation";
import { cardOgImage, loadImageDataUrl, OG_SIZE } from "@/lib/og";
import { getPublicProfile, getSiteSettings } from "@/lib/public-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Profil de l'auteur";

export default async function Image({ params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const [profile, settings] = await Promise.all([getPublicProfile(pseudo), getSiteSettings()]);
  if (!profile) notFound();
  const { author, total } = profile;
  return cardOgImage({
    title: author.name,
    byline: `@${author.username} · ${total} texte${total > 1 ? "s" : ""}`,
    avatar: await loadImageDataUrl(author.image),
    siteName: settings.siteName,
  });
}
