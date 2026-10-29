import { notFound } from "next/navigation";
import { cardOgImage, loadImageDataUrl, OG_SIZE, photoOgImage } from "@/lib/og";
import { getPublishedPost, getSiteSettings } from "@/lib/public-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Aperçu du texte";

export default async function Image({ params }: { params: Promise<{ pseudo: string; slug: string }> }) {
  const { pseudo, slug } = await params;
  const [data, settings] = await Promise.all([getPublishedPost(pseudo, slug), getSiteSettings()]);
  if (!data) notFound();
  const photo = await loadImageDataUrl(data.post.ogImageUrl);
  if (photo) return photoOgImage(photo);
  return cardOgImage({
    title: data.post.title || "Sans titre",
    byline: data.author.name,
    avatar: await loadImageDataUrl(data.author.image),
    siteName: settings.siteName,
  });
}
