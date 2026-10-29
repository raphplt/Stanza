import { cardOgImage, OG_SIZE } from "@/lib/og";
import { getSiteSettings } from "@/lib/public-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Stanza";

export default async function Image() {
  const settings = await getSiteSettings();
  return cardOgImage({ title: settings.tagline, byline: settings.siteName, siteName: settings.siteName });
}
