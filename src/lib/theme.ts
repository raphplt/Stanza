import type { UserTheme } from "@/db/schema";

export function applyTheme(theme: UserTheme) {
  try {
    if (theme === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {}
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function storedTheme(): UserTheme {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : "auto";
  } catch {
    return "auto";
  }
}
