const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function formatFrenchDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFormatter.format(d);
}

export function formatShortFrenchDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return shortDateFormatter.format(d);
}

export function formatFrenchDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateTimeFormatter.format(d);
}

export function shouldShowModifiedDate(
  publishedAt: Date | string | null | undefined,
  updatedAt: Date | string | null | undefined,
): boolean {
  if (!publishedAt || !updatedAt) return false;
  const pub = typeof publishedAt === "string" ? new Date(publishedAt).getTime() : publishedAt.getTime();
  const upd = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
  return upd - pub > 24 * 60 * 60 * 1000;
}
