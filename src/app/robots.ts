import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/studio",
        "/admin",
        "/s/",
        "/api/",
        "/connexion",
        "/demande-acces",
        "/invitation/",
        "/reinitialiser/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
