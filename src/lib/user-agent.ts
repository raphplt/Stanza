const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Appareil inconnu";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Navigateur";
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  return system ? `${browser} sur ${system}` : browser;
}
