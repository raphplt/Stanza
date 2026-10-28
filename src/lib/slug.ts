export const RESERVED_USERNAMES = new Set([
  "connexion",
  "demande-acces",
  "invitation",
  "reinitialiser",
  "studio",
  "admin",
  "s",
  "api",
  "mentions-legales",
  "rss",
  "rss.xml",
  "sitemap",
  "sitemap.xml",
  "robots",
  "robots.txt",
  "favicon.ico",
  "opengraph-image",
  "icon",
  "apple-icon",
  "manifest.webmanifest",
  "_next",
  "static",
  "public",
  "assets",
  "auth",
  "login",
  "logout",
  "register",
  "signup",
  "settings",
  "compte",
  "profil",
  "ecrire",
  "textes",
  "nouveau",
  "stanza",
  "root",
  "system",
  "support",
  "contact",
  "about",
  "help",
]);

export const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(value));
}

export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsername(value);
  return USERNAME_REGEX.test(normalized) && !RESERVED_USERNAMES.has(normalized);
}

export function slugify(input: string): string {
  const cleaned = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return cleaned || "sans-titre";
}

export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
