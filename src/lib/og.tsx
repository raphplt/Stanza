import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { absoluteUrl } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

const PAPER = "#fbf9f4";
const INK = "#1d1b18";
const MUTED = "#6a645b";
const LINE = "#e6e0d5";
const ACCENT = "#8c3a1f";

const SUPPORTED = new Set(["image/png", "image/jpeg", "image/gif"]);

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 500 }[]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all(
    ([400, 500] as const).map(async (weight) => ({
      name: "Newsreader",
      weight,
      data: await fs.readFile(path.join(process.cwd(), `src/assets/fonts/newsreader-${weight}.woff`)),
    })),
  );
  return fontsPromise;
}

function sniffType(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  return null;
}

export async function loadImageDataUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    let bytes: Uint8Array;
    if (url.startsWith("/api/upload/local/")) {
      const base = path.resolve(process.cwd(), ".local-blobs");
      const file = path.resolve(base, ...url.slice("/api/upload/local/".length).split("/"));
      if (!file.startsWith(base)) return null;
      bytes = new Uint8Array(await fs.readFile(file));
    } else {
      const res = await fetch(url.startsWith("/") ? absoluteUrl(url) : url);
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    const type = sniffType(bytes);
    if (!type || !SUPPORTED.has(type)) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function photoOgImage(dataUrl: string) {
  return new ImageResponse(
    // biome-ignore lint/performance/noImgElement: rendered by Satori, not the browser
    <img src={dataUrl} alt="" width={OG_SIZE.width} height={OG_SIZE.height} style={{ objectFit: "cover" }} />,
    OG_SIZE,
  );
}

export async function cardOgImage({
  title,
  byline,
  avatar,
  siteName,
}: {
  title: string;
  byline: string;
  avatar?: string | null;
  siteName: string;
}) {
  const size = title.length > 90 ? 56 : title.length > 50 ? 68 : 84;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        color: INK,
        padding: "72px 88px",
        fontFamily: "Newsreader",
        borderBottom: `12px solid ${ACCENT}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: MUTED }}>{siteName}</div>
      <div
        style={{
          display: "flex",
          fontSize: size,
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          maxHeight: size * 1.1 * 4,
          overflow: "hidden",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          paddingTop: 32,
          borderTop: `2px solid ${LINE}`,
          fontSize: 36,
          color: MUTED,
        }}
      >
        {avatar && (
          // biome-ignore lint/performance/noImgElement: rendered by Satori, not the browser
          <img src={avatar} alt="" width={64} height={64} style={{ borderRadius: 64, objectFit: "cover" }} />
        )}
        {byline}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
